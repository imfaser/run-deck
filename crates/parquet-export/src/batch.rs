use std::sync::Arc;

use arrow::array::{
    Array, ArrayRef, BinaryArray, Float32Array, Int32Array, ListArray, StringArray, StructArray,
};
use arrow::datatypes::{DataType, Field, Schema};
use arrow::record_batch::RecordBatch;
use parquet::file::metadata::KeyValue;

/// 导出的 volume 文件级元数据（写入 parquet `key_value_metadata`）。
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct VolumeMeta {
    pub axis: String,
    pub dtype: String,
    pub endian: String,
    pub x: i32,
    pub y: i32,
    pub z: i32,
}

/// 把 volume 元数据序列化为单个 `volume` KeyValue。
#[must_use]
pub fn volume_key_value(meta: &VolumeMeta) -> KeyValue {
    let value = serde_json::to_string(meta).unwrap_or_default();
    KeyValue::new("volume".to_string(), Some(value))
}

/// 单个切片的导出数据（扁平化后，直接映射 parquet 列）。
#[derive(Debug, Clone, PartialEq)]
pub struct SliceRow {
    /// 切片序号。
    pub index: i32,
    /// 图像 hash。
    pub hash: String,
    /// 切片 PNG 字节。
    pub slice_png: Vec<u8>,
    /// mask PNG 字节（无 mask 时为 None）。
    pub mask_png: Option<Vec<u8>>,
    /// 切片内去重标签。
    pub labels: Vec<LabelRow>,
    /// 切片内所有 box（携带 label_id）。
    pub boxes: Vec<BoxRow>,
    /// 切片内所有点（携带 label_id）。
    pub points: Vec<PointRow>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LabelRow {
    pub label_id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BoxRow {
    pub label_id: String,
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PointRow {
    pub label_id: String,
    pub x: f32,
    pub y: f32,
    /// "positive" | "negative"
    pub sign: String,
}

/// 把所有切片组装成单个 Arrow `RecordBatch`。
///
/// 列为：`index`, `hash`, `slice`(PNG binary), `mask`(PNG binary, nullable),
/// `label`/`boxes`/`point` 为对象数组。
pub fn build_slices_batch(rows: &[SliceRow]) -> arrow::error::Result<RecordBatch> {
    let mut indices: Vec<i32> = Vec::with_capacity(rows.len());
    let mut hashes: Vec<String> = Vec::new();
    let mut slice_pngs: Vec<Vec<u8>> = Vec::new();
    let mut mask_pngs: Vec<Option<Vec<u8>>> = Vec::new();

    let mut labels_offsets: Vec<i32> = vec![0];
    let mut label_ids: Vec<String> = Vec::new();
    let mut label_names: Vec<String> = Vec::new();

    let mut boxes_offsets: Vec<i32> = vec![0];
    let mut box_label_ids: Vec<String> = Vec::new();
    let mut box_x1: Vec<f32> = Vec::new();
    let mut box_y1: Vec<f32> = Vec::new();
    let mut box_x2: Vec<f32> = Vec::new();
    let mut box_y2: Vec<f32> = Vec::new();

    let mut points_offsets: Vec<i32> = vec![0];
    let mut point_label_ids: Vec<String> = Vec::new();
    let mut point_x: Vec<f32> = Vec::new();
    let mut point_y: Vec<f32> = Vec::new();
    let mut point_sign: Vec<String> = Vec::new();

    for row in rows {
        for l in &row.labels {
            label_ids.push(l.label_id.clone());
            label_names.push(l.name.clone());
        }
        labels_offsets.push(label_ids.len() as i32);

        for b in &row.boxes {
            box_label_ids.push(b.label_id.clone());
            box_x1.push(b.x1);
            box_y1.push(b.y1);
            box_x2.push(b.x2);
            box_y2.push(b.y2);
        }
        boxes_offsets.push(box_label_ids.len() as i32);

        for p in &row.points {
            point_label_ids.push(p.label_id.clone());
            point_x.push(p.x);
            point_y.push(p.y);
            point_sign.push(p.sign.clone());
        }
        points_offsets.push(point_label_ids.len() as i32);

        indices.push(row.index);
        hashes.push(row.hash.clone());
        slice_pngs.push(row.slice_png.clone());
        mask_pngs.push(row.mask_png.clone());
    }

    // label struct: { label_id, name }
    let label_fields: arrow::datatypes::Fields = vec![
        Field::new("label_id", DataType::Utf8, false),
        Field::new("name", DataType::Utf8, false),
    ]
    .into();
    let label_struct = StructArray::new(
        label_fields.clone(),
        vec![
            Arc::new(StringArray::from(label_ids)) as ArrayRef,
            Arc::new(StringArray::from(label_names)),
        ],
        None,
    );
    let label_list = ListArray::new(
        Arc::new(Field::new("item", DataType::Struct(label_fields), true)),
        arrow::buffer::OffsetBuffer::new(labels_offsets.into()),
        Arc::new(label_struct),
        None,
    );

    // boxes struct: { label_id, x1, y1, x2, y2 }
    let box_fields: arrow::datatypes::Fields = vec![
        Field::new("label_id", DataType::Utf8, false),
        Field::new("x1", DataType::Float32, false),
        Field::new("y1", DataType::Float32, false),
        Field::new("x2", DataType::Float32, false),
        Field::new("y2", DataType::Float32, false),
    ]
    .into();
    let box_struct = StructArray::new(
        box_fields.clone(),
        vec![
            Arc::new(StringArray::from(box_label_ids)) as ArrayRef,
            Arc::new(Float32Array::from(box_x1)),
            Arc::new(Float32Array::from(box_y1)),
            Arc::new(Float32Array::from(box_x2)),
            Arc::new(Float32Array::from(box_y2)),
        ],
        None,
    );
    let box_list = ListArray::new(
        Arc::new(Field::new("item", DataType::Struct(box_fields), true)),
        arrow::buffer::OffsetBuffer::new(boxes_offsets.into()),
        Arc::new(box_struct),
        None,
    );

    // point struct: { label_id, x, y, sign }
    let point_fields: arrow::datatypes::Fields = vec![
        Field::new("label_id", DataType::Utf8, false),
        Field::new("x", DataType::Float32, false),
        Field::new("y", DataType::Float32, false),
        Field::new("sign", DataType::Utf8, false),
    ]
    .into();
    let point_struct = StructArray::new(
        point_fields.clone(),
        vec![
            Arc::new(StringArray::from(point_label_ids)) as ArrayRef,
            Arc::new(Float32Array::from(point_x)),
            Arc::new(Float32Array::from(point_y)),
            Arc::new(StringArray::from(point_sign)),
        ],
        None,
    );
    let point_list = ListArray::new(
        Arc::new(Field::new("item", DataType::Struct(point_fields), true)),
        arrow::buffer::OffsetBuffer::new(points_offsets.into()),
        Arc::new(point_struct),
        None,
    );

    let index_arr = Int32Array::from(indices);
    let hash_arr = StringArray::from(hashes);
    let slice_arr = BinaryArray::from_iter_values(slice_pngs.iter().map(Vec::as_slice));
    let mask_arr = BinaryArray::from_iter(mask_pngs.iter().map(|m| m.as_deref()));

    let schema = Arc::new(Schema::new(vec![
        Field::new("index", DataType::Int32, false),
        Field::new("hash", DataType::Utf8, false),
        Field::new("slice", DataType::Binary, false),
        Field::new("mask", DataType::Binary, true),
        Field::new("label", label_list.data_type().clone(), false),
        Field::new("boxes", box_list.data_type().clone(), false),
        Field::new("point", point_list.data_type().clone(), false),
    ]));

    RecordBatch::try_new(
        schema,
        vec![
            Arc::new(index_arr) as ArrayRef,
            Arc::new(hash_arr),
            Arc::new(slice_arr),
            Arc::new(mask_arr),
            Arc::new(label_list),
            Arc::new(box_list),
            Arc::new(point_list),
        ],
    )
}

/// 把切片数据写入 parquet 文件。
///
/// `volume` 可选：提供时作为文件级 `volume` 元数据写入（axis/dtype/endian/xyz）。
pub fn write_slices_parquet(
    rows: &[SliceRow],
    output_path: &str,
    volume: Option<&VolumeMeta>,
) -> anyhow::Result<()> {
    use parquet::arrow::ArrowWriter;
    use parquet::basic::Compression;
    use parquet::file::properties::WriterProperties;

    let batch = build_slices_batch(rows).map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let file = std::fs::File::create(output_path)
        .map_err(|e| anyhow::anyhow!("failed to create file: {e}"))?;
    let mut props = WriterProperties::builder()
        .set_compression(Compression::SNAPPY);
    if let Some(meta) = volume {
        props = props.set_key_value_metadata(Some(vec![volume_key_value(meta)]));
    }
    let props = props.build();
    let mut writer = ArrowWriter::try_new(file, batch.schema(), Some(props))
        .map_err(|e| anyhow::anyhow!("failed to create parquet writer: {e}"))?;
    writer
        .write(&batch)
        .map_err(|e| anyhow::anyhow!("failed to write parquet: {e}"))?;
    writer
        .close()
        .map_err(|e| anyhow::anyhow!("failed to close parquet writer: {e}"))?;

    Ok(())
}
