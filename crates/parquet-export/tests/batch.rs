use arrow::array::{Array, BinaryArray, Int32Array, ListArray, StringArray, StructArray};
use arrow::datatypes::DataType;

use parquet_export::batch::{
    BoxRow, LabelRow, PointRow, SliceRow, VolumeMeta, build_slices_batch, volume_key_value,
    write_slices_parquet,
};

fn sample_rows() -> Vec<SliceRow> {
    vec![
        SliceRow {
            index: 0,
            hash: "h0".to_string(),
            slice_png: vec![1, 2, 3],
            mask_png: Some(vec![4, 5]),
            labels: vec![LabelRow {
                label_id: "L1".to_string(),
                name: "tumor".to_string(),
            }],
            boxes: vec![BoxRow {
                label_id: "L1".to_string(),
                x1: 1.0,
                y1: 2.0,
                x2: 3.0,
                y2: 4.0,
            }],
            points: vec![PointRow {
                label_id: "L1".to_string(),
                x: 5.0,
                y: 6.0,
                sign: "positive".to_string(),
            }],
        },
        SliceRow {
            index: 1,
            hash: "h1".to_string(),
            slice_png: vec![7, 8],
            mask_png: None,
            labels: vec![
                LabelRow {
                    label_id: "L1".to_string(),
                    name: "tumor".to_string(),
                },
                LabelRow {
                    label_id: "L2".to_string(),
                    name: "stroma".to_string(),
                },
            ],
            boxes: vec![
                BoxRow {
                    label_id: "L1".to_string(),
                    x1: 0.0,
                    y1: 0.0,
                    x2: 10.0,
                    y2: 10.0,
                },
                BoxRow {
                    label_id: "L2".to_string(),
                    x1: 1.0,
                    y1: 1.0,
                    x2: 2.0,
                    y2: 2.0,
                },
            ],
            points: vec![],
        },
    ]
}

#[test]
fn batch_has_expected_shape() {
    let batch = build_slices_batch(&sample_rows()).unwrap();
    assert_eq!(batch.num_rows(), 2);
    let schema = batch.schema();
    let fields: Vec<&str> = schema.fields().iter().map(|f| f.name().as_str()).collect();
    assert_eq!(fields, vec!["index", "hash", "slice", "mask", "label", "boxes", "point"]);

    let idx = batch.column(0).as_any().downcast_ref::<Int32Array>().unwrap();
    assert_eq!(idx.values(), &[0, 1]);

    let hash = batch.column(1).as_any().downcast_ref::<StringArray>().unwrap();
    assert_eq!(hash.value(0), "h0");
    assert_eq!(hash.value(1), "h1");

    let slice = batch.column(2).as_any().downcast_ref::<BinaryArray>().unwrap();
    assert_eq!(slice.value(0), &[1, 2, 3]);
    assert_eq!(slice.value(1), &[7, 8]);
}

#[test]
fn batch_mask_nullability() {
    let batch = build_slices_batch(&sample_rows()).unwrap();
    let mask = batch.column(3).as_any().downcast_ref::<BinaryArray>().unwrap();
    assert_eq!(mask.is_valid(0), true);
    assert_eq!(mask.value(0), &[4, 5]);
    assert_eq!(mask.is_valid(1), false);
    // schema 里 mask 可空
    assert!(batch.schema().field(3).is_nullable());
}

#[test]
fn batch_label_lists_are_nested() {
    let batch = build_slices_batch(&sample_rows()).unwrap();
    let labels = batch.column(4).as_any().downcast_ref::<ListArray>().unwrap();
    assert_eq!(labels.value_length(0), 1);
    assert_eq!(labels.value_length(1), 2);

    let l0 = labels.value(0);
    let s0 = l0.as_any().downcast_ref::<StructArray>().unwrap();
    let ids = s0.column(0).as_any().downcast_ref::<StringArray>().unwrap();
    let names = s0.column(1).as_any().downcast_ref::<StringArray>().unwrap();
    assert_eq!(ids.value(0), "L1");
    assert_eq!(names.value(0), "tumor");

    let l1 = labels.value(1);
    let s1 = l1.as_any().downcast_ref::<StructArray>().unwrap();
    let ids1 = s1.column(0).as_any().downcast_ref::<StringArray>().unwrap();
    assert_eq!(ids1.value(0), "L1");
    assert_eq!(ids1.value(1), "L2");
}

#[test]
fn batch_boxes_and_points_nesting() {
    let batch = build_slices_batch(&sample_rows()).unwrap();
    let boxes = batch.column(5).as_any().downcast_ref::<ListArray>().unwrap();
    assert_eq!(boxes.value_length(0), 1);
    assert_eq!(boxes.value_length(1), 2);
    let points = batch.column(6).as_any().downcast_ref::<ListArray>().unwrap();
    assert_eq!(points.value_length(0), 1);
    assert_eq!(points.value_length(1), 0);
}

#[test]
fn batch_empty_rows() {
    let batch = build_slices_batch(&[]).unwrap();
    assert_eq!(batch.num_rows(), 0);
    assert_eq!(batch.schema().fields().len(), 7);
}

#[test]
fn write_parquet_roundtrips() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("out.parquet");
    write_slices_parquet(&sample_rows(), path.to_str().unwrap(), None).unwrap();
    assert!(path.exists());

    let file = std::fs::File::open(&path).unwrap();
    let reader = parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder::try_new(file)
        .unwrap()
        .build()
        .unwrap();
    let batches: Vec<_> = reader.collect::<Result<_, _>>().unwrap();
    assert_eq!(batches.len(), 1);
    assert_eq!(batches[0].num_rows(), 2);
    assert_eq!(batches[0].schema().fields().len(), 7);
    // 字段名与类型一致
    let schema = batches[0].schema();
    let f = schema.field(3);
    assert_eq!(f.name(), "mask");
    assert_eq!(f.data_type(), &DataType::Binary);
    let f = schema.field(4);
    assert_eq!(f.name(), "label");
    assert!(matches!(f.data_type(), DataType::List(_)));
}

#[test]
fn write_parquet_null_mask_roundtrips() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mask.parquet");
    write_slices_parquet(&sample_rows(), path.to_str().unwrap(), None).unwrap();
    let file = std::fs::File::open(&path).unwrap();
    let reader = parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder::try_new(file)
        .unwrap()
        .build()
        .unwrap();
    let batches: Vec<_> = reader.collect::<Result<_, _>>().unwrap();
    let mask = batches[0]
        .column(3)
        .as_any()
        .downcast_ref::<BinaryArray>()
        .unwrap();
    assert!(mask.is_valid(0));
    assert!(!mask.is_valid(1));
}

#[test]
fn volume_key_value_serializes() {
    let meta = VolumeMeta {
        axis: "z".to_string(),
        dtype: "u16".to_string(),
        endian: "little".to_string(),
        x: 512,
        y: 256,
        z: 128,
    };
    let kv = volume_key_value(&meta);
    assert_eq!(kv.key, "volume");
    let value = kv.value.expect("volume metadata should have a value");
    assert!(value.contains("\"axis\":\"z\""));
    assert!(value.contains("\"dtype\":\"u16\""));
    assert!(value.contains("\"endian\":\"little\""));
    assert!(value.contains("\"x\":512"));
    assert!(value.contains("\"y\":256"));
    assert!(value.contains("\"z\":128"));
}

#[test]
fn write_parquet_volume_metadata_roundtrips() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("volume.parquet");
    let meta = VolumeMeta {
        axis: "x".to_string(),
        dtype: "u8".to_string(),
        endian: "big".to_string(),
        x: 64,
        y: 32,
        z: 16,
    };
    write_slices_parquet(&sample_rows(), path.to_str().unwrap(), Some(&meta)).unwrap();
    let file = std::fs::File::open(&path).unwrap();
    let builder = parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder::try_new(file)
        .unwrap();
    let kv = builder
        .metadata()
        .file_metadata()
        .key_value_metadata()
        .expect("volume metadata should be written");
    let volume = kv
        .iter()
        .find(|k| k.key == "volume")
        .expect("volume metadata entry should exist");
    let value = volume.value.as_deref().unwrap();
    assert!(value.contains("\"axis\":\"x\""));
    assert!(value.contains("\"z\":16"));
}
