use anyhow::{Context, bail};
use base64::Engine as _;
use image::GrayImage;
use serde_json::{Value, json};

/// 单个 SAM 正/负提示点。
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PointPrompt {
    pub x: f64,
    pub y: f64,
    /// 0 = 负点，1 = 正点。
    pub label: i8,
}

/// 单个 SAM 边界框提示（像素坐标）。
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BoxPrompt {
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

/// 单个 SAM 分割对象（通常对应一个标注/标签）。
#[derive(Debug, Clone)]
pub struct SegmentObject {
    pub points: Vec<PointPrompt>,
    pub box_coords: Option<BoxPrompt>,
}

/// 单个标注的 SAM 提示分组（一个 annotation，可能含多个 box）。
#[derive(Debug, Clone)]
pub struct PromptGroup {
    pub points: Vec<PointPrompt>,
    pub boxes: Vec<BoxPrompt>,
}

/// `build_segment_objects` 的结果。
#[derive(Debug)]
pub struct BuildSegmentObjectsResult {
    pub objects: Vec<SegmentObject>,
    /// 因没有可归属的 box 而被丢弃的点数。
    pub dropped_points: usize,
}

/// locate-anything 检测到的边界框（归一化 0-1000 坐标）。
#[derive(Debug, Clone, PartialEq)]
pub struct DetectedBox {
    pub name: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub score: Option<f64>,
}

/// detect 任务的目标标签（匹配检测框 name）。
#[derive(Debug, Clone)]
pub struct DetectTarget {
    pub label_id: String,
    pub label_name: String,
    pub sub_labels: Vec<String>,
}

/// 已匹配 label 的检测框，坐标为像素值。
#[derive(Debug, Clone, PartialEq)]
pub struct MappedBox {
    pub label_id: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
}

/// 将灰度切片数据编码为 PNG 字节。
///
/// # Errors
///
/// 返回错误如果 `data.len() != width * height` 或 PNG 编码失败。
pub fn slice_to_png_bytes(data: &[u8], width: usize, height: usize) -> anyhow::Result<Vec<u8>> {
    if data.len() != width * height {
        bail!(
            "slice data length {} does not match {width}×{height} = {}",
            data.len(),
            width * height
        );
    }

    let img = GrayImage::from_raw(
        u32::try_from(width).map_err(|_| anyhow::anyhow!("width too large: {width}"))?,
        u32::try_from(height).map_err(|_| anyhow::anyhow!("height too large: {height}"))?,
        data.to_vec(),
    )
    .context("failed to create grayscale image")?;

    let mut buf = Vec::new();
    image::DynamicImage::ImageLuma8(img)
        .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
        .context("failed to encode PNG")?;
    Ok(buf)
}

/// 将标注提示转为 SAM3 `objects` JSON 数组。
///
/// 每个 object 形如 `{ "points": [{"coords": [x, y], "label": 0|1}], "box": {"coords": [x1,y1,x2,y2]}? }`，
/// 匹配 `sam3/schemas/mcp.py` 的 `Object`/`PointPrompt`/`BoundingBox`。
#[must_use]
pub fn annotations_to_segment_objects(annos: &[SegmentObject]) -> Value {
    let objects: Vec<Value> = annos
        .iter()
        .map(|a| {
            let points: Vec<Value> = a
                .points
                .iter()
                .map(|p| {
                    json!({ "coords": [p.x.round() as i64, p.y.round() as i64], "label": p.label })
                })
                .collect();
            let mut obj = serde_json::Map::new();
            obj.insert("points".to_string(), Value::Array(points));
            if let Some(b) = &a.box_coords {
                obj.insert(
                    "box".to_string(),
                    json!({ "coords": [b.x1, b.y1, b.x2, b.y2] }),
                );
            }
            Value::Object(obj)
        })
        .collect();
    Value::Array(objects)
}

/// 判断点是否位于 box 内（含边界）。
#[must_use]
pub fn point_in_box(p: &PointPrompt, b: &BoxPrompt) -> bool {
    p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2
}

/// 按 box 分组组装 SAM3 objects，保证「点组数 == box 数」。
///
/// - 全请求无 box：每个 group 独立产出 `{ points, 无 box }`，各 label 互不合并。
/// - 存在 box：每个 box 一个 object（含 box 内点）；无 box 可归属的点丢弃并计数，
///   使每个 object 都带 box，满足 `sam3/transform/segment.py` 的对齐约束。
#[must_use]
pub fn build_segment_objects(groups: &[PromptGroup]) -> BuildSegmentObjectsResult {
    let has_boxes = groups.iter().any(|g| !g.boxes.is_empty());
    if !has_boxes {
        let objects: Vec<SegmentObject> = groups
            .iter()
            .filter(|g| !g.points.is_empty())
            .map(|g| SegmentObject {
                points: g.points.clone(),
                box_coords: None,
            })
            .collect();
        return BuildSegmentObjectsResult {
            objects,
            dropped_points: 0,
        };
    }

    let mut objects = Vec::new();
    let mut dropped_points = 0;
    for group in groups {
        if group.boxes.is_empty() {
            dropped_points += group.points.len();
            continue;
        }
        for b in &group.boxes {
            let points: Vec<PointPrompt> = group
                .points
                .iter()
                .filter(|p| point_in_box(p, b))
                .copied()
                .collect();
            objects.push(SegmentObject {
                points,
                box_coords: Some(*b),
            });
        }
        dropped_points += group
            .points
            .iter()
            .filter(|p| !group.boxes.iter().any(|b| point_in_box(p, b)))
            .count();
    }
    BuildSegmentObjectsResult {
        objects,
        dropped_points,
    }
}

/// 组装 `sam3/segment_image` 请求参数。
///
/// 服务端签名为 `segment_image(req: MCPRequest, ctx: Context)`，全部字段必须包在 `req` 键下。
#[must_use]
pub fn build_segment_request(
    image_b64: &str,
    objects: &Value,
    prev_mask_b64: Option<&str>,
    multimask: bool,
) -> Value {
    json!({
        "req": {
            "image": image_b64,
            "objects": objects,
            "prev_mask": prev_mask_b64,
            "multimask_output": multimask,
        }
    })
}

/// 组装 `locate-anything/locate` 请求参数（文本 detect 模式）。
///
/// 服务端签名为 `locate(req: MCPRequest, ctx: Context)`，全部字段必须包在 `req` 键下。
#[must_use]
pub fn build_locate_request(image_b64: &str, categories: &[String]) -> Value {
    json!({
        "req": {
            "image": image_b64,
            "task": "detect",
            "categories": categories,
        }
    })
}

/// 从 MCP image content 中解析出 PNG 字节。
///
/// 兼容 `data:image/png;base64,<...>` 与纯 base64 两种形式。
/// 返回 `None` 表示 base64 解码失败。
pub fn parse_mask_png(content: &str) -> Option<Vec<u8>> {
    let b64 = content
        .strip_prefix("data:image/png;base64,")
        .or_else(|| content.strip_prefix("data:image/png;base64"))
        .unwrap_or(content);
    base64::engine::general_purpose::STANDARD
        .decode(b64)
        .ok()
        .filter(|bytes| !bytes.is_empty())
}

/// 解析 locate 文本结果中的检测框。
///
/// 支持 `{ "boxes": [...] }` 与裸数组两种结构；解析失败返回空列表。
#[must_use]
pub fn parse_boxes(text: &str) -> Vec<DetectedBox> {
    let value: Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let arr = value
        .get("boxes")
        .and_then(Value::as_array)
        .or_else(|| value.as_array());
    let Some(arr) = arr else {
        return Vec::new();
    };

    arr.iter()
        .filter_map(|b| {
            let name = b.get("name").and_then(Value::as_str)?.to_string();
            let x1 = b.get("x1").and_then(Value::as_f64)?;
            let y1 = b.get("y1").and_then(Value::as_f64)?;
            let x2 = b.get("x2").and_then(Value::as_f64)?;
            let y2 = b.get("y2").and_then(Value::as_f64)?;
            let score = b.get("score").and_then(Value::as_f64);
            Some(DetectedBox {
                name,
                x1,
                y1,
                x2,
                y2,
                score,
            })
        })
        .collect()
}

/// 将归一化 0-1000 坐标的检测框映射为像素坐标的标注框。
///
/// `box.name` 匹配 `target.label_name` 或任一 `sub_labels`；未匹配跳过。
#[must_use]
pub fn map_boxes_to_annotations(
    boxes: &[DetectedBox],
    targets: &[DetectTarget],
    width: usize,
    height: usize,
) -> Vec<MappedBox> {
    let w = width as f64;
    let h = height as f64;
    boxes
        .iter()
        .filter_map(|b| {
            let target = targets
                .iter()
                .find(|t| t.label_name == b.name || t.sub_labels.iter().any(|s| s == &b.name))?;
            Some(MappedBox {
                label_id: target.label_id.clone(),
                x1: b.x1 / 1000.0 * w,
                y1: b.y1 / 1000.0 * h,
                x2: b.x2 / 1000.0 * w,
                y2: b.y2 / 1000.0 * h,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slice_to_png_roundtrip() {
        let data: Vec<u8> = (0..64).map(|i| i * 4).collect();
        let png = slice_to_png_bytes(&data, 8, 8).unwrap();
        let decoded = image::load_from_memory(&png).unwrap();
        let luma = decoded.to_luma8();
        assert_eq!(luma.width(), 8);
        assert_eq!(luma.height(), 8);
        assert_eq!(luma.as_raw(), &data);
    }

    #[test]
    fn slice_to_png_len_mismatch() {
        assert!(slice_to_png_bytes(&[0u8; 10], 3, 3).is_err());
    }

    #[test]
    fn objects_json_shape() {
        let annos = vec![SegmentObject {
            points: vec![
                PointPrompt { x: 1.0, y: 2.0, label: 1 },
                PointPrompt { x: 3.0, y: 4.0, label: 0 },
            ],
            box_coords: Some(BoxPrompt {
                x1: 10.0,
                y1: 20.0,
                x2: 30.0,
                y2: 40.0,
            }),
        }];
        let value = annotations_to_segment_objects(&annos);
        let objects = value.as_array().unwrap();
        assert_eq!(objects.len(), 1);
        let obj = &objects[0];
        assert_eq!(obj["points"][0]["coords"], json!([1, 2]));
        assert_eq!(obj["points"][1]["label"], json!(0));
        assert_eq!(obj["box"], json!({ "coords": [10.0, 20.0, 30.0, 40.0] }));
    }

    #[test]
    fn objects_json_without_box() {
        let annos = vec![SegmentObject {
            points: vec![],
            box_coords: None,
        }];
        let value = annotations_to_segment_objects(&annos);
        assert!(value[0].get("box").is_none());
    }

    #[test]
    fn segment_request_shape() {
        let value = build_segment_request("aGk=", &json!([{"points": []}]), Some("bHk="), true);
        assert_eq!(value["req"]["image"], "aGk=");
        assert_eq!(value["req"]["prev_mask"], "bHk=");
        assert_eq!(value["req"]["multimask_output"], true);
        assert_eq!(value["req"]["objects"][0]["points"], json!([]));
    }

    #[test]
    fn segment_request_null_prev_mask() {
        let value = build_segment_request("aGk=", &json!([]), None, false);
        assert!(value["req"]["prev_mask"].is_null());
    }

    #[test]
    fn locate_request_shape() {
        let cats = vec!["tumor".to_string(), "stroma".to_string()];
        let value = build_locate_request("aGk=", &cats);
        assert_eq!(value["req"]["image"], "aGk=");
        assert_eq!(value["req"]["task"], "detect");
        assert_eq!(value["req"]["categories"], json!(["tumor", "stroma"]));
    }

    #[test]
    fn parse_mask_png_data_uri() {
        let png = slice_to_png_bytes(&[0u8; 4], 2, 2).unwrap();
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
        let uri = format!("data:image/png;base64,{b64}");
        assert_eq!(parse_mask_png(&uri), Some(png.clone()));
        assert_eq!(parse_mask_png(&b64), Some(png));
    }

    #[test]
    fn parse_mask_png_invalid() {
        assert_eq!(parse_mask_png("!!!not-base64!!!"), None);
    }

    #[test]
    fn parse_boxes_object_form() {
        let text = r#"{"boxes":[{"name":"tumor","score":0.9,"x1":100,"y1":50,"x2":200,"y2":150}]}"#;
        let boxes = parse_boxes(text);
        assert_eq!(boxes.len(), 1);
        assert_eq!(boxes[0].name, "tumor");
        assert_eq!(boxes[0].score, Some(0.9));
        assert_eq!(boxes[0].x1, 100.0);
    }

    #[test]
    fn parse_boxes_array_form() {
        let text = r#"[{"name":"stroma","x1":0,"y1":0,"x2":10,"y2":10}]"#;
        let boxes = parse_boxes(text);
        assert_eq!(boxes.len(), 1);
        assert_eq!(boxes[0].name, "stroma");
    }

    #[test]
    fn parse_boxes_invalid() {
        assert!(parse_boxes("not json").is_empty());
    }

    #[test]
    fn parse_boxes_missing_fields() {
        let text = r#"{"boxes":[{"name":"tumor"}]}"#;
        assert!(parse_boxes(text).is_empty());
    }

    #[test]
    fn map_boxes_matches_sublabel() {
        let boxes = vec![DetectedBox {
            name: "nucleus".to_string(),
            x1: 100.0,
            y1: 200.0,
            x2: 300.0,
            y2: 400.0,
            score: None,
        }];
        let targets = vec![DetectTarget {
            label_id: "L1".to_string(),
            label_name: "tumor".to_string(),
            sub_labels: vec!["nucleus".to_string()],
        }];
        let mapped = map_boxes_to_annotations(&boxes, &targets, 1000, 1000);
        assert_eq!(mapped.len(), 1);
        assert_eq!(mapped[0].label_id, "L1");
        assert_eq!(mapped[0].x1, 100.0);
        assert_eq!(mapped[0].y1, 200.0);
        assert_eq!(mapped[0].x2, 300.0);
        assert_eq!(mapped[0].y2, 400.0);
    }

    #[test]
    fn map_boxes_scales_coords() {
        let boxes = vec![DetectedBox {
            name: "tumor".to_string(),
            x1: 500.0,
            y1: 250.0,
            x2: 1000.0,
            y2: 500.0,
            score: None,
        }];
        let targets = vec![DetectTarget {
            label_id: "L1".to_string(),
            label_name: "tumor".to_string(),
            sub_labels: vec![],
        }];
        let mapped = map_boxes_to_annotations(&boxes, &targets, 100, 200);
        assert_eq!(mapped.len(), 1);
        assert_eq!(mapped[0].x1, 50.0);
        assert_eq!(mapped[0].y1, 50.0);
        assert_eq!(mapped[0].x2, 100.0);
        assert_eq!(mapped[0].y2, 100.0);
    }

    #[test]
    fn map_boxes_skips_unmatched() {
        let boxes = vec![DetectedBox {
            name: "unknown".to_string(),
            x1: 0.0,
            y1: 0.0,
            x2: 10.0,
            y2: 10.0,
            score: None,
        }];
        let targets = vec![DetectTarget {
            label_id: "L1".to_string(),
            label_name: "tumor".to_string(),
            sub_labels: vec![],
        }];
        assert!(map_boxes_to_annotations(&boxes, &targets, 100, 100).is_empty());
    }

    // ── Additional coverage tests ───────────────────────────────────

    #[test]
    fn objects_json_empty() {
        let value = annotations_to_segment_objects(&[]);
        let arr = value.as_array().unwrap();
        assert!(arr.is_empty());
    }

    #[test]
    fn objects_json_multiple() {
        let annos = vec![
            SegmentObject {
                points: vec![PointPrompt { x: 1.0, y: 2.0, label: 1 }],
                box_coords: None,
            },
            SegmentObject {
                points: vec![],
                box_coords: Some(BoxPrompt {
                    x1: 0.0,
                    y1: 0.0,
                    x2: 5.0,
                    y2: 5.0,
                }),
            },
        ];
        let value = annotations_to_segment_objects(&annos);
        assert_eq!(value.as_array().unwrap().len(), 2);
        assert!(value[0].get("box").is_none());
        assert!(value[1].get("box").is_some());
    }

    #[test]
    fn parse_mask_png_empty_base64() {
        assert_eq!(parse_mask_png(""), None);
    }

    #[test]
    fn parse_mask_png_valid_raw_base64() {
        let png = slice_to_png_bytes(&[128u8; 4], 2, 2).unwrap();
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
        assert_eq!(parse_mask_png(&b64), Some(png));
    }

    #[test]
    fn parse_boxes_empty_array() {
        assert!(parse_boxes("[]").is_empty());
    }

    #[test]
    fn parse_boxes_score_missing() {
        let text = r#"{"boxes":[{"name":"tumor","x1":0,"y1":0,"x2":10,"y2":10}]}"#;
        let boxes = parse_boxes(text);
        assert_eq!(boxes.len(), 1);
        assert!(boxes[0].score.is_none());
    }

    #[test]
    fn parse_boxes_multiple() {
        let text =
            r#"{"boxes":[{"name":"a","x1":0,"y1":0,"x2":1,"y2":1},{"name":"b","x1":2,"y1":2,"x2":3,"y2":3}]}"#;
        let boxes = parse_boxes(text);
        assert_eq!(boxes.len(), 2);
        assert_eq!(boxes[0].name, "a");
        assert_eq!(boxes[1].name, "b");
    }

    #[test]
    fn map_boxes_empty_boxes() {
        let targets = vec![DetectTarget {
            label_id: "L1".to_string(),
            label_name: "tumor".to_string(),
            sub_labels: vec![],
        }];
        assert!(map_boxes_to_annotations(&[], &targets, 100, 100).is_empty());
    }

    #[test]
    fn map_boxes_multiple_targets() {
        let boxes = vec![
            DetectedBox {
                name: "tumor".to_string(),
                x1: 0.0,
                y1: 0.0,
                x2: 500.0,
                y2: 500.0,
                score: Some(0.9),
            },
            DetectedBox {
                name: "stroma".to_string(),
                x1: 500.0,
                y1: 500.0,
                x2: 1000.0,
                y2: 1000.0,
                score: Some(0.8),
            },
        ];
        let targets = vec![
            DetectTarget {
                label_id: "L1".to_string(),
                label_name: "tumor".to_string(),
                sub_labels: vec![],
            },
            DetectTarget {
                label_id: "L2".to_string(),
                label_name: "stroma".to_string(),
                sub_labels: vec![],
            },
        ];
        let mapped = map_boxes_to_annotations(&boxes, &targets, 200, 400);
        assert_eq!(mapped.len(), 2);
        assert_eq!(mapped[0].label_id, "L1");
        assert_eq!(mapped[1].label_id, "L2");
        // tumor: x1=0/1000*200=0, y1=0/1000*400=0, x2=500/1000*200=100, y2=500/1000*400=200
        assert_eq!(mapped[0].x1, 0.0);
        assert_eq!(mapped[0].y2, 200.0);
    }

    #[test]
    fn build_segment_request_multimask_false() {
        let value = build_segment_request("img", &json!([]), None, false);
        assert_eq!(value["req"]["multimask_output"], false);
        assert!(value["req"]["prev_mask"].is_null());
    }

    #[test]
    fn build_locate_request_empty_categories() {
        let value = build_locate_request("img", &[]);
        assert_eq!(value["req"]["categories"], json!([]));
    }

    #[test]
    fn slice_to_png_1x1() {
        let data = vec![42u8];
        let png = slice_to_png_bytes(&data, 1, 1).unwrap();
        let decoded = image::load_from_memory(&png).unwrap();
        let luma = decoded.to_luma8();
        assert_eq!(luma.width(), 1);
        assert_eq!(luma.height(), 1);
        assert_eq!(luma.as_raw(), &[42]);
    }

    // ── build_segment_objects 对齐测试 ────────────────────────────────

    #[test]
    fn point_in_box_bounds() {
        let b = BoxPrompt {
            x1: 10.0,
            y1: 20.0,
            x2: 30.0,
            y2: 40.0,
        };
        assert!(point_in_box(&PointPrompt { x: 10.0, y: 20.0, label: 1 }, &b));
        assert!(point_in_box(&PointPrompt { x: 30.0, y: 40.0, label: 1 }, &b));
        assert!(!point_in_box(&PointPrompt { x: 9.0, y: 30.0, label: 1 }, &b));
        assert!(!point_in_box(&PointPrompt { x: 30.0, y: 41.0, label: 1 }, &b));
    }

    #[test]
    fn build_segment_objects_points_only_keeps_labels_separate() {
        let groups = vec![
            PromptGroup {
                points: vec![PointPrompt { x: 1.0, y: 2.0, label: 1 }],
                boxes: vec![],
            },
            PromptGroup {
                points: vec![PointPrompt { x: 3.0, y: 4.0, label: 0 }],
                boxes: vec![],
            },
        ];
        let res = build_segment_objects(&groups);
        assert_eq!(res.objects.len(), 2);
        assert_eq!(res.dropped_points, 0);
        assert!(res.objects[0].box_coords.is_none());
        assert!(res.objects[1].box_coords.is_none());
        assert_eq!(res.objects[0].points.len(), 1);
        assert_eq!(res.objects[1].points.len(), 1);
    }

    #[test]
    fn build_segment_objects_points_only_skips_empty_group() {
        let groups = vec![PromptGroup {
            points: vec![],
            boxes: vec![],
        }];
        let res = build_segment_objects(&groups);
        assert!(res.objects.is_empty());
        assert_eq!(res.dropped_points, 0);
    }

    #[test]
    fn build_segment_objects_groups_points_by_box() {
        let groups = vec![PromptGroup {
            points: vec![
                PointPrompt { x: 5.0, y: 5.0, label: 1 },
                PointPrompt { x: 25.0, y: 25.0, label: 0 },
            ],
            boxes: vec![
                BoxPrompt { x1: 0.0, y1: 0.0, x2: 10.0, y2: 10.0 },
                BoxPrompt { x1: 20.0, y1: 20.0, x2: 30.0, y2: 30.0 },
            ],
        }];
        let res = build_segment_objects(&groups);
        assert_eq!(res.objects.len(), 2);
        assert_eq!(res.dropped_points, 0);
        assert_eq!(res.objects[0].points.len(), 1);
        assert_eq!(res.objects[0].points[0].x, 5.0);
        assert_eq!(res.objects[1].points.len(), 1);
        assert_eq!(res.objects[1].points[0].x, 25.0);
        assert!(res.objects[0].box_coords.is_some());
        assert!(res.objects[1].box_coords.is_some());
    }

    #[test]
    fn build_segment_objects_box_without_points() {
        let groups = vec![PromptGroup {
            points: vec![],
            boxes: vec![BoxPrompt {
                x1: 0.0,
                y1: 0.0,
                x2: 10.0,
                y2: 10.0,
            }],
        }];
        let res = build_segment_objects(&groups);
        assert_eq!(res.objects.len(), 1);
        assert!(res.objects[0].points.is_empty());
        assert!(res.objects[0].box_coords.is_some());
        assert_eq!(res.dropped_points, 0);
    }

    #[test]
    fn build_segment_objects_drops_orphan_points() {
        let groups = vec![
            PromptGroup {
                points: vec![PointPrompt { x: 5.0, y: 5.0, label: 1 }],
                boxes: vec![BoxPrompt { x1: 0.0, y1: 0.0, x2: 10.0, y2: 10.0 }],
            },
            PromptGroup {
                points: vec![
                    PointPrompt { x: 50.0, y: 50.0, label: 1 },
                    PointPrompt { x: 51.0, y: 51.0, label: 0 },
                ],
                boxes: vec![],
            },
        ];
        let res = build_segment_objects(&groups);
        assert_eq!(res.objects.len(), 1);
        assert_eq!(res.dropped_points, 2);
        assert!(res.objects[0].box_coords.is_some());
        assert_eq!(res.objects[0].points.len(), 1);
    }

    #[test]
    fn build_segment_objects_drops_point_outside_all_boxes() {
        let groups = vec![PromptGroup {
            points: vec![
                PointPrompt { x: 5.0, y: 5.0, label: 1 },
                PointPrompt { x: 99.0, y: 99.0, label: 1 },
            ],
            boxes: vec![BoxPrompt { x1: 0.0, y1: 0.0, x2: 10.0, y2: 10.0 }],
        }];
        let res = build_segment_objects(&groups);
        assert_eq!(res.objects.len(), 1);
        assert_eq!(res.objects[0].points.len(), 1);
        assert_eq!(res.dropped_points, 1);
    }
}
