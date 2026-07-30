use std::collections::HashMap;
use std::sync::{Arc, LazyLock, Mutex};

use arrow::array::{
    Array, ArrayRef, BinaryArray, Float32Array, Int32Array, Int8Array, ListArray, StringArray,
    StructArray,
};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use nimg::raw::{Axis, Endian, RawVolume, VolumeShape, VoxBuf};
use parquet::arrow::ArrowWriter;
use parquet::basic::Compression;
use parquet::file::properties::WriterProperties;
use serde::{Deserialize, Serialize};

use super::{CmdResult, StringifyErr};

use crate::kernel::context::AppContext;
use logging::{logging, Type};

// ─── Global volume store ───────────────────────────────────────────

struct VolumeStore {
    volumes: HashMap<String, RawVolume>,
    axis: HashMap<String, Axis>,
    voxel_size: HashMap<String, usize>,
}

static VOLUME_STORE: LazyLock<Mutex<VolumeStore>> = LazyLock::new(|| {
    Mutex::new(VolumeStore {
        volumes: HashMap::new(),
        axis: HashMap::new(),
        voxel_size: HashMap::new(),
    })
});

fn gen_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{t:x}")
}

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

// ─── Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub fn raw_open(req: OpenRequest) -> CmdResult<OpenResponse> {
    let shape = VolumeShape::new(req.z, req.y, req.x);
    let (voxel_size, _dtype_name) = match req.dtype.as_str() {
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

    let vol = RawVolume::open(&req.path, shape, voxel_size, endian).stringify_err()?;

    let total_slices = shape.dim(axis);
    let (slice_h, slice_w) = shape.perpendicular(axis);

    let id = gen_id();
    let mut store = VOLUME_STORE.lock().stringify_err()?;
    store.volumes.insert(id.clone(), vol);
    store.axis.insert(id.clone(), axis);
    store.voxel_size.insert(id.clone(), voxel_size);

    Ok(OpenResponse {
        volume_id: id,
        total_slices,
        slice_width: slice_w,
        slice_height: slice_h,
    })
}

#[tauri::command]
pub fn raw_slice(volume_id: String, index: usize) -> CmdResult<SliceResponse> {
    let store = VOLUME_STORE.lock().stringify_err()?;
    let vol = store
        .volumes
        .get(&volume_id)
        .ok_or("volume not found")?;
    let axis = store.axis.get(&volume_id).copied().unwrap_or(Axis::Z);
    let voxel_size = store.voxel_size.get(&volume_id).copied().unwrap_or(1);
    let (h, w) = vol.shape().perpendicular(axis);

    match voxel_size {
        1 => {
            let slice: VoxBuf<u8> = vol.slice_at(axis, index).stringify_err()?;
            let data = slice.as_slice();
            let min = data.iter().copied().min().unwrap_or(0) as f64;
            let max = data.iter().copied().max().unwrap_or(255) as f64;
            Ok(SliceResponse {
                data: data.to_vec(),
                width: w,
                height: h,
                min,
                max,
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
            Ok(SliceResponse {
                data: normalized,
                width: w,
                height: h,
                min,
                max,
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

#[tauri::command]
pub fn raw_close(volume_id: String) -> CmdResult {
    let mut store = VOLUME_STORE.lock().stringify_err()?;
    store.volumes.remove(&volume_id);
    store.axis.remove(&volume_id);
    store.voxel_size.remove(&volume_id);
    Ok(())
}
