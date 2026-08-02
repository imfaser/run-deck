use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use arrow::array::{
    Array, ArrayRef, BinaryArray, Float32Array, Int32Array, Int8Array, ListArray, StringArray,
    StructArray,
};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use db::models::annotation::PointSign;
use nimg::raw::{Axis, Endian, RawVolume, VolumeShape, VoxBuf};
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::{CmdResult, StringifyErr};

use crate::kernel::context::AppContext;
use crate::kernel::volume_store::VolumeEntry;
use crate::utils::async_handler::AsyncHandler;
use logging::{logging, Type};

// ─── Input / Output types ──────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRequest {
    pub path: String,
    pub x: usize,
    pub y: usize,
    pub z: usize,
    pub dtype: String,
    pub endian: String,
    pub axis: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResponse {
    pub volume_id: String,
    pub total_slices: usize,
    pub slice_width: usize,
    pub slice_height: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SliceResponse {
    pub data: Vec<u8>,
    pub width: usize,
    pub height: usize,
    pub min: f64,
    pub max: f64,
    pub image_hash: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoxCoord {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointCoord {
    pub x: f32,
    pub y: f32,
    pub label: i8,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelEntry {
    pub name: String,
    pub sub_names: Vec<String>,
    pub boxes: Vec<BoxCoord>,
    pub points: Vec<PointCoord>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeMeta {
    pub axis: String,
    pub dtype: String,
    pub endian: String,
    pub x_size: i32,
    pub y_size: i32,
    pub z_size: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParquetMaskEntry {
    pub id: String,
    pub layer: i32,
    pub labels: Vec<LabelEntry>,
    pub mask_png_path: String,
    pub meta: VolumeMeta,
}

// ─── Helpers ───────────────────────────────────────────────────────

fn gen_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

fn canonicalize_path(path: &str) -> CmdResult<String> {
    match std::fs::canonicalize(path) {
        Ok(canonical) => Ok(canonical.to_string_lossy().to_string()),
        // Fallback to original path if canonicalize fails (file may have been deleted)
        Err(_) => Ok(path.to_string()),
    }
}

// ─── Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn open_raw(req: OpenRequest) -> CmdResult<OpenResponse> {
    logging!(info, Type::Cmd, "open_raw: path={}", req.path);

    if crate::task::TaskRunner::is_running() {
        return Err("批量任务运行中，无法打开卷".into());
    }

    let shape = VolumeShape::new(req.z, req.y, req.x);
    let (voxel_size, dtype_name) = match req.dtype.as_str() {
        "u8" | "uint8" => (1usize, "u8"),
        "u16" | "uint16" => (2usize, "u16"),
        other => return Err(format!("unsupported dtype: {other}")),
    };
    let endian = match req.endian.as_str() {
        "little" | "le" => Endian::Little,
        "big" | "be" => Endian::Big,
        other => return Err(format!("unsupported endian: {other}")),
    };
    let axis = match req.axis.as_str() {
        "x" | "X" => Axis::X,
        "y" | "Y" => Axis::Y,
        "z" | "Z" => Axis::Z,
        other => return Err(format!("unsupported axis: {other}")),
    };

    // Canonicalize path
    let path_str = canonicalize_path(&req.path)?;

    let vol = RawVolume::open(&path_str, shape, voxel_size, endian).stringify_err()?;

    let total_slices = shape.dim(axis);
    let (slice_h, slice_w) = shape.perpendicular(axis);

    let id = gen_id();

    // Replace into single-slot VolumeStore，并级联删除旧 volume 的 DB 数据
    let store = AppContext::volume_store();
    let mut db = AppContext::db().clone();
    let old = store.replace(VolumeEntry {
        volume_id: id.clone(),
        path: path_str,
        volume: vol,
        axis,
        voxel_size,
        total_slices,
        slice_width: slice_w,
        slice_height: slice_h,
    });
    if let Some(old_entry) = old {
        if let Err(e) = db::ops::volume_ops::delete_volume_cascade(&mut db, &old_entry.volume_id).await
        {
            logging!(warn, Type::Cmd, "open_raw: failed to cascade delete old volume: {e}");
        }
    }

    // Best-effort sync Volume row to DB
    let x = req.x as i32;
    let y = req.y as i32;
    let z = req.z as i32;
    if let Err(e) =
        db::ops::volume_ops::create_or_get_volume(&mut db, &id, x, y, z, dtype_name, &req.endian, &req.axis)
            .await
    {
        logging!(warn, Type::Cmd, "open_raw: failed to sync Volume row to DB: {e}");
    }

    Ok(OpenResponse {
        volume_id: id,
        total_slices,
        slice_width: slice_w,
        slice_height: slice_h,
    })
}

#[tauri::command]
pub async fn has_raw(path: String) -> CmdResult<Option<OpenResponse>> {
    let path_str = canonicalize_path(&path)?;

    let store = AppContext::volume_store();
    let guard = store.lock();
    Ok(guard.as_ref().filter(|e| e.path == path_str).map(|e| {
        OpenResponse {
            volume_id: e.volume_id.clone(),
            total_slices: e.total_slices,
            slice_width: e.slice_width,
            slice_height: e.slice_height,
        }
    }))
}

#[tauri::command]
pub fn raw_slice(volume_id: String, index: usize) -> CmdResult<SliceResponse> {
    let store = AppContext::volume_store();
    let guard = store.lock();
    let entry = guard.as_ref().ok_or("volume not found")?;

    if entry.volume_id != volume_id {
        return Err("volume not found".into());
    }

    let vol = &entry.volume;
    let axis = entry.axis;
    let voxel_size = entry.voxel_size;
    let (h, w) = vol.shape().perpendicular(axis);

    match voxel_size {
        1 => {
            let slice: VoxBuf<u8> = vol.slice_at(axis, index).stringify_err()?;
            let data = slice.as_slice();
            let min = data.iter().copied().min().unwrap_or(0) as f64;
            let max = data.iter().copied().max().unwrap_or(255) as f64;
            let image_hash = hex::encode(Sha256::digest(data));
            Ok(SliceResponse {
                data: data.to_vec(),
                width: w,
                height: h,
                min,
                max,
                image_hash,
            })
        }
        2 => {
            let slice: VoxBuf<u16> = vol.slice_at(axis, index).stringify_err()?;
            let values = slice.as_slice();
            let min = values.iter().copied().min().unwrap_or(0) as f64;
            let max = values.iter().copied().max().unwrap_or(65535) as f64;
            let range = if max > min { max - min } else { 1.0 };
            let normalized: Vec<u8> = values
                .iter()
                .map(|&v| ((v as f64 - min) / range * 255.0).round() as u8)
                .collect();
            let image_hash = hex::encode(Sha256::digest(bytemuck::cast_slice(values)));
            Ok(SliceResponse {
                data: normalized,
                width: w,
                height: h,
                min,
                max,
                image_hash,
            })
        }
        _ => Err("unsupported voxel size".into()),
    }
}

#[tauri::command]
pub fn parquet_export_masks(
    _volume_id: String,
    masks: Vec<ParquetMaskEntry>,
    output_path: String,
) -> CmdResult<String> {
    let cache = AppContext::content_cache();

    logging!(info, Type::Cmd, "parquet_export_masks: {} masks -> {}", masks.len(), output_path);

    // ── Collect PNG bytes ───────────────────────────────────────────
    let mut png_bytes_list: Vec<Vec<u8>> = Vec::with_capacity(masks.len());
    for entry in &masks {
        // Try cache first (hash), fallback to file path
        let cache_path = cache.get_path(&entry.mask_png_path);
        let bytes = if cache_path.exists() {
            std::fs::read(&cache_path)
                .map_err(|e| format!("cache read failed for {}: {e}", entry.mask_png_path))?
        } else {
            std::fs::read(&entry.mask_png_path)
                .map_err(|e| format!("failed to read mask PNG {}: {e}", entry.mask_png_path))?
        };
        png_bytes_list.push(bytes);
    }

    // ── Flatten labels into nested arrays ──────────────────────────
    let mut label_names: Vec<&str> = Vec::new();
    let mut sub_name_strs: Vec<&str> = Vec::new();
    let mut sub_names_offsets: Vec<i32> = vec![0];
    let mut box_x1: Vec<f32> = Vec::new();
    let mut box_y1: Vec<f32> = Vec::new();
    let mut box_x2: Vec<f32> = Vec::new();
    let mut box_y2: Vec<f32> = Vec::new();
    let mut boxes_offsets: Vec<i32> = vec![0];
    let mut pt_x: Vec<f32> = Vec::new();
    let mut pt_y: Vec<f32> = Vec::new();
    let mut pt_label: Vec<i8> = Vec::new();
    let mut points_offsets: Vec<i32> = vec![0];
    let mut labels_offsets: Vec<i32> = vec![0];

    for entry in &masks {
        for label in &entry.labels {
            label_names.push(&label.name);
            for s in &label.sub_names {
                sub_name_strs.push(s);
            }
            sub_names_offsets.push(sub_name_strs.len() as i32);
            for b in &label.boxes {
                box_x1.push(b.x1);
                box_y1.push(b.y1);
                box_x2.push(b.x2);
                box_y2.push(b.y2);
            }
            boxes_offsets.push(box_x1.len() as i32);
            for p in &label.points {
                pt_x.push(p.x);
                pt_y.push(p.y);
                pt_label.push(p.label);
            }
            points_offsets.push(pt_x.len() as i32);
        }
        labels_offsets.push(label_names.len() as i32);
    }

    // ── Build Arrow arrays bottom-up ───────────────────────────────

    // points struct
    let points_fields: arrow::datatypes::Fields = vec![
        Field::new("x", DataType::Float32, true),
        Field::new("y", DataType::Float32, true),
        Field::new("label", DataType::Int8, true),
    ]
    .into();
    let points_struct = StructArray::new(
        points_fields.clone(),
        vec![
            Arc::new(Float32Array::from(pt_x)) as ArrayRef,
            Arc::new(Float32Array::from(pt_y)),
            Arc::new(Int8Array::from(pt_label)),
        ],
        None,
    );
    let points_list = ListArray::new(
        Arc::new(Field::new("item", DataType::Struct(points_fields.clone()), true)),
        arrow::buffer::OffsetBuffer::new(points_offsets.into()),
        Arc::new(points_struct),
        None,
    );

    // boxes struct
    let boxes_fields: arrow::datatypes::Fields = vec![
        Field::new("x1", DataType::Float32, true),
        Field::new("y1", DataType::Float32, true),
        Field::new("x2", DataType::Float32, true),
        Field::new("y2", DataType::Float32, true),
    ]
    .into();
    let boxes_struct = StructArray::new(
        boxes_fields.clone(),
        vec![
            Arc::new(Float32Array::from(box_x1)) as ArrayRef,
            Arc::new(Float32Array::from(box_y1)),
            Arc::new(Float32Array::from(box_x2)),
            Arc::new(Float32Array::from(box_y2)),
        ],
        None,
    );
    let boxes_list = ListArray::new(
        Arc::new(Field::new("item", DataType::Struct(boxes_fields.clone()), true)),
        arrow::buffer::OffsetBuffer::new(boxes_offsets.into()),
        Arc::new(boxes_struct),
        None,
    );

    // sub_names list
    let sub_names_arr = StringArray::from(sub_name_strs);
    let sub_names_list = ListArray::new(
        Arc::new(Field::new("item", DataType::Utf8, true)),
        arrow::buffer::OffsetBuffer::new(sub_names_offsets.into()),
        Arc::new(sub_names_arr),
        None,
    );

    // label struct (name, sub_names, boxes, points)
    let label_fields: arrow::datatypes::Fields = vec![
        Field::new("name", DataType::Utf8, true),
        Field::new(
            "sub_names",
            DataType::List(Arc::new(Field::new("item", DataType::Utf8, true))),
            true,
        ),
        Field::new(
            "boxes",
            DataType::List(Arc::new(Field::new(
                "item",
                DataType::Struct(boxes_fields),
                true,
            ))),
            true,
        ),
        Field::new(
            "points",
            DataType::List(Arc::new(Field::new(
                "item",
                DataType::Struct(points_fields),
                true,
            ))),
            true,
        ),
    ]
    .into();
    let label_struct = StructArray::new(
        label_fields.clone(),
        vec![
            Arc::new(StringArray::from(label_names)) as ArrayRef,
            Arc::new(sub_names_list),
            Arc::new(boxes_list),
            Arc::new(points_list),
        ],
        None,
    );

    // labels list
    let labels_arr = ListArray::new(
        Arc::new(Field::new("item", DataType::Struct(label_fields), false)),
        arrow::buffer::OffsetBuffer::new(labels_offsets.into()),
        Arc::new(label_struct),
        None,
    );

    // meta struct
    let meta_fields: arrow::datatypes::Fields = vec![
        Field::new("axis", DataType::Utf8, false),
        Field::new("dtype", DataType::Utf8, false),
        Field::new("endian", DataType::Utf8, false),
        Field::new("x_size", DataType::Int32, false),
        Field::new("y_size", DataType::Int32, false),
        Field::new("z_size", DataType::Int32, false),
    ]
    .into();
    let meta_arr = StructArray::new(
        meta_fields.clone(),
        vec![
            Arc::new(StringArray::from(
                masks.iter().map(|e| e.meta.axis.as_str()).collect::<Vec<_>>(),
            )) as ArrayRef,
            Arc::new(StringArray::from(
                masks.iter().map(|e| e.meta.dtype.as_str()).collect::<Vec<_>>(),
            )),
            Arc::new(StringArray::from(
                masks.iter().map(|e| e.meta.endian.as_str()).collect::<Vec<_>>(),
            )),
            Arc::new(Int32Array::from(
                masks.iter().map(|e| e.meta.x_size).collect::<Vec<_>>(),
            )),
            Arc::new(Int32Array::from(
                masks.iter().map(|e| e.meta.y_size).collect::<Vec<_>>(),
            )),
            Arc::new(Int32Array::from(
                masks.iter().map(|e| e.meta.z_size).collect::<Vec<_>>(),
            )),
        ],
        None,
    );

    // simple columns
    let id_arr = StringArray::from(masks.iter().map(|e| e.id.as_str()).collect::<Vec<_>>());
    let layer_arr = Int32Array::from(masks.iter().map(|e| e.layer).collect::<Vec<_>>());
    let mask_arr = BinaryArray::from_iter_values(png_bytes_list.iter().map(Vec::as_slice));

    // ── Assemble RecordBatch ───────────────────────────────────────
    let schema = Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("layer", DataType::Int32, false),
        Field::new("labels", labels_arr.data_type().clone(), false),
        Field::new("mask", DataType::Binary, false),
        Field::new("meta", DataType::Struct(meta_fields), false),
    ]));

    let batch = RecordBatch::try_new(
        schema,
        vec![
            Arc::new(id_arr) as ArrayRef,
            Arc::new(layer_arr),
            Arc::new(labels_arr),
            Arc::new(mask_arr),
            Arc::new(meta_arr),
        ],
    )
    .map_err(|e| format!("failed to build record batch: {e}"))?;

    // ── Write Parquet ──────────────────────────────────────────────
    let file =
        std::fs::File::create(&output_path).map_err(|e| format!("failed to create file: {e}"))?;
    let props = WriterProperties::builder()
        .set_compression(Compression::SNAPPY)
        .build();
    let mut writer = ArrowWriter::try_new(file, batch.schema(), Some(props))
        .map_err(|e| format!("failed to create parquet writer: {e}"))?;
    writer
        .write(&batch)
        .map_err(|e| format!("failed to write parquet: {e}"))?;
    writer
        .close()
        .map_err(|e| format!("failed to close parquet writer: {e}"))?;

    Ok(output_path)
}

/// 导出当前 volume 全部切片的 PNG + 标注为 parquet。
///
/// 每行一个切片，列为：`index`(切片序号), `hash`, `slice`(切片 PNG), `mask`(mask PNG),
/// `label`/`boxes`/`point` 各为对象数组（`label` 为去重标签，`boxes`/`point` 携带 `label_id`）。
#[tauri::command]
pub async fn parquet_export_slices(volume_id: String, output_path: String) -> CmdResult<String> {
    logging!(info, Type::Cmd, "parquet_export_slices: volume={volume_id} -> {output_path}");

    // 持锁期间同步读出全部切片，避免跨 await 持有 MutexGuard。
    // 内存占用与 volume 大小成正比（gray8 + hash_bytes + 生成中的 PNG）。
    let (slices, volume_meta) = {
        let store = AppContext::volume_store();
        let guard = store.lock();
        let entry = guard.as_ref().ok_or("volume not loaded")?;
        if entry.volume_id != volume_id {
            return Err("volume not found".into());
        }
        let shape = entry.volume.shape();
        let axis = match entry.axis {
            Axis::X => "x",
            Axis::Y => "y",
            Axis::Z => "z",
        };
        let dtype = match entry.voxel_size {
            1 => "u8",
            2 => "u16",
            other => return Err(format!("unsupported voxel size: {other}")),
        };
        let endian = match entry.volume.endian() {
            nimg::raw::Endian::Little => "little",
            nimg::raw::Endian::Big => "big",
        };
        let volume_meta = parquet_export::batch::VolumeMeta {
            axis: axis.to_string(),
            dtype: dtype.to_string(),
            endian: endian.to_string(),
            x: shape.x as i32,
            y: shape.y as i32,
            z: shape.z as i32,
        };
        let mut out = Vec::with_capacity(entry.total_slices);
        for index in 0..entry.total_slices as i32 {
            out.push(crate::task::runner::read_slice_from_entry(entry, index)?);
        }
        (out, volume_meta)
    };

    let mut db = AppContext::db().clone();
    let labels = db::ops::label_ops::list_labels(&mut db)
        .await
        .map_err(|e| e.to_string())?;
    let label_name: HashMap<uuid::Uuid, String> =
        labels.iter().map(|l| (l.id, l.name.clone())).collect();

    // 批量加载 volume 的 images + 标注，避免 N 次往返
    let images = db::ops::image_ops::list_images_by_volume(&mut db, &volume_id)
        .await
        .map_err(|e| e.to_string())?;
    let mask_by_hash: HashMap<String, Option<String>> = images
        .iter()
        .map(|i| (i.hash.clone(), i.mask_hash.clone()))
        .collect();
    let annos_by_hash: HashMap<String, Vec<db::models::annotation::Annotation>> =
        db::ops::annotation_ops::list_annotations_by_volume(&mut db, &volume_id)
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .fold(HashMap::<String, Vec<_>>::new(), |mut acc, a| {
                acc.entry(a.image_id.clone()).or_default().push(a);
                acc
            });

    let mut rows: Vec<parquet_export::batch::SliceRow> = Vec::with_capacity(slices.len());
    for slice in &slices {
        let image_hash = hex::encode(Sha256::digest(&slice.hash_bytes));
        let slice_png =
            nimg::ops::slice_to_png_bytes(&slice.gray8, slice.width, slice.height)
                .map_err(|e| e.to_string())?;

        let mask_png = mask_by_hash
            .get(&image_hash)
            .and_then(|m| m.as_deref())
            .map(|mh| {
                let path = AppContext::content_cache().get_path(mh);
                if path.exists() {
                    std::fs::read(&path).ok()
                } else {
                    None
                }
            })
            .flatten();

        let annos = annos_by_hash.get(&image_hash).map(Vec::as_slice).unwrap_or(&[]);

        // label：切片内去重
        let mut seen = HashSet::new();
        let mut labels_rows = Vec::new();
        for a in annos {
            if seen.insert(a.label_id) {
                labels_rows.push(parquet_export::batch::LabelRow {
                    label_id: a.label_id.to_string(),
                    name: label_name
                        .get(&a.label_id)
                        .cloned()
                        .unwrap_or_else(|| a.label_id.to_string()),
                });
            }
        }

        let boxes_rows = annos
            .iter()
            .flat_map(|a| {
                a.boxes.iter().map(|b| parquet_export::batch::BoxRow {
                    label_id: a.label_id.to_string(),
                    x1: b.x1 as f32,
                    y1: b.y1 as f32,
                    x2: b.x2 as f32,
                    y2: b.y2 as f32,
                })
            })
            .collect();

        let points_rows = annos
            .iter()
            .flat_map(|a| {
                a.points.iter().map(|p| parquet_export::batch::PointRow {
                    label_id: a.label_id.to_string(),
                    x: p.x as f32,
                    y: p.y as f32,
                    sign: match p.sign {
                        PointSign::Positive => "positive",
                        PointSign::Negative => "negative",
                    }
                    .to_string(),
                })
            })
            .collect();

        rows.push(parquet_export::batch::SliceRow {
            index: slice.index,
            hash: image_hash,
            slice_png,
            mask_png,
            labels: labels_rows,
            boxes: boxes_rows,
            points: points_rows,
        });
    }

    parquet_export::batch::write_slices_parquet(&rows, &output_path, Some(&volume_meta))
        .map_err(|e| e.to_string())?;

    Ok(output_path)
}

#[tauri::command]
pub fn raw_close(volume_id: String) -> CmdResult {
    let store = AppContext::volume_store();
    // Peek first to check if volume_id matches before taking
    {
        let guard = store.lock();
        match guard.as_ref() {
            Some(e) if e.volume_id != volume_id => return Err("volume not found".into()),
            None => return Err("no volume open".into()),
            _ => {} // volume_id matches, proceed to close
        }
    }
    // Safe to take now — volume_id matched
    let _entry = store.close();
    let closed_id = volume_id.clone();
    // 级联删除该 volume 的 DB 数据
    if let Err(e) = AsyncHandler::block_on(async move {
        let mut db = AppContext::db().clone();
        db::ops::volume_ops::delete_volume_cascade(&mut db, &closed_id).await
    }) {
        logging!(warn, Type::Cmd, "raw_close: failed to cascade delete volume: {e}");
    }
    logging!(info, Type::Cmd, "raw_close: closed volume {volume_id}");
    Ok(())
}

/// 读取 DB 中唯一 Volume 行并返回当前卷信息。
#[tauri::command]
pub async fn get_current_volume() -> CmdResult<Option<OpenResponse>> {
    let mut db = AppContext::db().clone();
    let volumes: Vec<db::models::volume::Volume> =
        db::models::volume::Volume::all().exec(&mut db).await.map_err(|e| e.to_string())?;
    let Some(volume) = volumes.into_iter().next() else {
        return Ok(None);
    };

    let axis = match volume.axis.as_str() {
        "x" | "X" => Axis::X,
        "y" | "Y" => Axis::Y,
        "z" | "Z" => Axis::Z,
        _ => Axis::Z,
    };
    let shape = VolumeShape::new(volume.z as usize, volume.y as usize, volume.x as usize);
    let total_slices = shape.dim(axis);
    let (slice_height, slice_width) = shape.perpendicular(axis);

    Ok(Some(OpenResponse {
        volume_id: volume.id,
        total_slices,
        slice_width,
        slice_height,
    }))
}
