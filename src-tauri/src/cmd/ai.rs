use super::{CmdResult, StringifyErr};
use base64::Engine as _;
use crate::kernel::context::AppContext;
use crate::kernel::notification::FrontendEvent;
use crate::task::runner::{ensure_image, extract_mask, read_slice_from_entry};
use db::models::annotation::{BoxType, PointSign};
use db::ops::annotation_ops::{self, AnnotationInput, BoxInput, PointInput};
use logging::{logging, Type};
use nimg::ops::{BoxPrompt, PointPrompt};
use sha2::{Digest, Sha256};

/// 单帧识别的单个对象（来自当前画布未保存标注）。
#[derive(serde::Deserialize)]
pub struct AiObjectInput {
    pub id: String,
    pub label_id: uuid::Uuid,
    pub points: Vec<PointInput>,
    pub boxes: Vec<BoxInput>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRecognizeResponse {
    pub mask_hash: String,
}

/// 单帧 AI 识别：保存当前标注 → 调 sam3 → mask 落 ContentCache → 更新 Image.mask_hash。
/// 不采用 prev_mask（仅批量 segment 任务使用）。
#[tauri::command]
pub async fn ai_recognize_slice(
    volume_id: String,
    index: usize,
    objects: Vec<AiObjectInput>,
) -> CmdResult<AiRecognizeResponse> {
    logging!(info, Type::Cmd, "ai_recognize_slice: volume={volume_id} index={index} objects={}", objects.len());

    if crate::task::TaskRunner::is_running() {
        return Err("批量任务运行中，无法单帧识别".into());
    }

    // 校验 volume 与读取 slice
    let entry = {
        let store = AppContext::volume_store();
        let guard = store.lock();
        let entry = guard.as_ref().ok_or_else(|| "volume not loaded".to_string())?;
        if entry.volume_id != volume_id {
            return Err("volume not found".into());
        }
        let index_i32 =
            i32::try_from(index).map_err(|_| "invalid slice index".to_string())?;
        read_slice_from_entry(entry, index_i32).stringify_err()?
    };

    let image_hash = hex::encode(Sha256::digest(&entry.hash_bytes));

    let mut db = AppContext::db().clone();

    ensure_image(&mut db, &image_hash, &entry, &volume_id)
        .await
        .stringify_err()?;

    // 保存当前画布标注（全量替换）
    let annotations: Vec<AnnotationInput> = objects
        .iter()
        .map(|o| AnnotationInput {
            id: o.id.clone(),
            label_id: o.label_id,
            boxes: o.boxes.clone(),
            points: o.points.clone(),
        })
        .collect();
    annotation_ops::set_annotations(&mut db, &image_hash, annotations)
        .await
        .stringify_err()?;

    // 组装 SAM3 prompts（不采用 prev_mask）：按 box 分组对齐点组与 box 维度
    let groups: Vec<nimg::ops::PromptGroup> = objects
        .iter()
        .map(|o| nimg::ops::PromptGroup {
            points: o
                .points
                .iter()
                .map(|p| PointPrompt {
                    x: p.x,
                    y: p.y,
                    label: if p.sign == PointSign::Positive { 1 } else { 0 },
                })
                .collect(),
            boxes: o
                .boxes
                .iter()
                .filter(|b| b.box_type == BoxType::Annotate)
                .map(|b| BoxPrompt {
                    x1: b.x1,
                    y1: b.y1,
                    x2: b.x2,
                    y2: b.y2,
                })
                .collect(),
        })
        .collect();
    let segment = nimg::ops::build_segment_objects(&groups);
    if segment.dropped_points > 0 {
        logging!(
            warn,
            Type::Cmd,
            "ai_recognize_slice: dropped {} box-less point(s)",
            segment.dropped_points
        );
    }
    let objects_json = nimg::ops::annotations_to_segment_objects(&segment.objects);

    let png = nimg::ops::slice_to_png_bytes(&entry.gray8, entry.width, entry.height)
        .stringify_err()?;
    let image_b64 = base64::engine::general_purpose::STANDARD.encode(&png);
    let request = nimg::ops::build_segment_request(&image_b64, &objects_json, None, false);

    let result = AppContext::mcp_manager()
        .call_tool("sam3", "segment_image", Some(request))
        .await
        .map_err(|e| format!("sam3 segment failed: {e}"))?;

    let mask_png = extract_mask(&result).ok_or_else(|| "sam3 returned no image mask".to_string())?;
    let mask_hash = AppContext::content_cache()
        .store_bytes(&mask_png)
        .await
        .stringify_err()?;

    db::ops::image_ops::update_mask_hash(&mut db, &image_hash, Some(&mask_hash))
        .await
        .stringify_err()?;

    AppContext::send_event(FrontendEvent::DbChanged);
    logging!(info, Type::Cmd, "ai_recognize_slice: done hash={image_hash} mask={mask_hash}");

    Ok(AiRecognizeResponse { mask_hash })
}
