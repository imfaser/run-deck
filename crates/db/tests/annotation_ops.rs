mod common;

use db::ops::annotation_ops::{
    list_annotations_by_image, list_annotation_counts, nearest_visual_box, set_annotations,
    AnnotationInput, BoxInput, PointInput,
};
use db::models::annotation::{BoxType, PointSign};
use db::models::image::ImageType;
use db::ops::{image_ops, label_ops};

#[tokio::test]
async fn test_set_annotations_replaces() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        Some("scan.png"),
        512,
        512,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let img = set_annotations(
        &mut db,
        "img-001",
        vec![AnnotationInput {
            id: "a1".to_string(),
            label_id: label.id,
            boxes: vec![BoxInput {
                id: "b1".to_string(),
                box_type: BoxType::Annotate,
                x1: 0.0,
                y1: 0.0,
                x2: 100.0,
                y2: 100.0,
            }],
            points: vec![],
        }],
    )
    .await
    .unwrap();

    assert_eq!(img.annotations.len(), 1);
    assert_eq!(img.annotations[0].id, "a1");
    assert_eq!(img.annotations[0].boxes.len(), 1);
    assert_eq!(img.annotations[0].boxes[0].box_type, BoxType::Annotate);

    let img = set_annotations(
        &mut db,
        "img-001",
        vec![AnnotationInput {
            id: "a2".to_string(),
            label_id: label.id,
            boxes: vec![],
            points: vec![PointInput {
                id: "p1".to_string(),
                x: 50.0,
                y: 50.0,
                sign: PointSign::Positive,
            }],
        }],
    )
    .await
    .unwrap();

    assert_eq!(img.annotations.len(), 1);
    assert_eq!(img.annotations[0].id, "a2");
    assert_eq!(img.annotations[0].points.len(), 1);
}

#[tokio::test]
async fn test_set_annotations_image_not_found() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    let result = set_annotations(
        &mut db,
        "nonexistent",
        vec![AnnotationInput {
            id: "a1".to_string(),
            label_id: label.id,
            boxes: vec![],
            points: vec![],
        }],
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_set_annotations_duplicate_annotation_id() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        Some("scan.png"),
        512,
        512,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let result = set_annotations(
        &mut db,
        "img-001",
        vec![
            AnnotationInput {
                id: "a1".to_string(),
                label_id: label.id,
                boxes: vec![],
                points: vec![],
            },
            AnnotationInput {
                id: "a1".to_string(),
                label_id: label.id,
                boxes: vec![],
                points: vec![],
            },
        ],
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_set_annotations_duplicate_box_id() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        Some("scan.png"),
        512,
        512,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let result = set_annotations(
        &mut db,
        "img-001",
        vec![AnnotationInput {
            id: "a1".to_string(),
            label_id: label.id,
            boxes: vec![
                BoxInput {
                    id: "b1".to_string(),
                    box_type: BoxType::Annotate,
                    x1: 0.0,
                    y1: 0.0,
                    x2: 100.0,
                    y2: 100.0,
                },
                BoxInput {
                    id: "b1".to_string(),
                    box_type: BoxType::Annotate,
                    x1: 10.0,
                    y1: 10.0,
                    x2: 90.0,
                    y2: 90.0,
                },
            ],
            points: vec![],
        }],
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_set_annotations_visual_constraint_ok() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        Some("scan.png"),
        512,
        512,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let result = set_annotations(
        &mut db,
        "img-001",
        vec![AnnotationInput {
            id: "a1".to_string(),
            label_id: label.id,
            boxes: vec![
                BoxInput {
                    id: "b1".to_string(),
                    box_type: BoxType::Visual,
                    x1: 0.0,
                    y1: 0.0,
                    x2: 100.0,
                    y2: 100.0,
                },
                BoxInput {
                    id: "b2".to_string(),
                    box_type: BoxType::Annotate,
                    x1: 10.0,
                    y1: 10.0,
                    x2: 90.0,
                    y2: 90.0,
                },
            ],
            points: vec![],
        }],
    )
    .await;

    assert!(result.is_ok());
}

#[tokio::test]
async fn test_set_annotations_visual_constraint_violated() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        Some("scan.png"),
        512,
        512,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let result = set_annotations(
        &mut db,
        "img-001",
        vec![
            AnnotationInput {
                id: "a1".to_string(),
                label_id: label.id,
                boxes: vec![BoxInput {
                    id: "b1".to_string(),
                    box_type: BoxType::Visual,
                    x1: 0.0,
                    y1: 0.0,
                    x2: 100.0,
                    y2: 100.0,
                }],
                points: vec![],
            },
            AnnotationInput {
                id: "a2".to_string(),
                label_id: label.id,
                boxes: vec![BoxInput {
                    id: "b2".to_string(),
                    box_type: BoxType::Visual,
                    x1: 10.0,
                    y1: 10.0,
                    x2: 90.0,
                    y2: 90.0,
                }],
                points: vec![],
            },
        ],
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_nearest_visual_box_volume() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    db::ops::volume_ops::create_or_get_volume(&mut db, "vol-001", 512, 512, 100, "uint8", "little", "axial")
        .await
        .unwrap();

    for i in 0..5 {
        image_ops::upsert_image(
            &mut db,
            &format!("slice-{i}"),
            None,
            100,
            100,
            ImageType::Slice,
            Some("vol-001"),
            Some(i),
            None,
        )
        .await
        .unwrap();
    }

    set_annotations(
        &mut db,
        "slice-3",
        vec![AnnotationInput {
            id: "a-3".to_string(),
            label_id: label.id,
            boxes: vec![BoxInput {
                id: "b-3".to_string(),
                box_type: BoxType::Visual,
                x1: 0.0,
                y1: 0.0,
                x2: 100.0,
                y2: 100.0,
            }],
            points: vec![],
        }],
    )
    .await
    .unwrap();

    let result = nearest_visual_box(&mut db, "slice-2", label.id)
        .await
        .unwrap();

    assert!(result.is_some());
    let v = result.unwrap();
    assert_eq!(v.image_hash, "slice-3");
    assert_eq!(v.box_id, "b-3");
}

#[tokio::test]
async fn test_nearest_visual_box_none() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        Some("scan.png"),
        512,
        512,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let result = nearest_visual_box(&mut db, "img-001", label.id)
        .await
        .unwrap();

    assert!(result.is_none());
}

#[tokio::test]
async fn test_label_sub_labels() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(
        &mut db,
        "tumor",
        "#ff0000",
        1,
        vec!["white".to_string(), "red".to_string()],
    )
    .await
    .unwrap();

    assert_eq!(label.sub_labels, vec!["white", "red"]);

    let updated = label_ops::update_label(
        &mut db,
        label.id,
        None,
        None,
        None,
        Some(vec!["white".to_string(), "red".to_string(), "blue".to_string()]),
    )
    .await
    .unwrap();

    assert_eq!(updated.sub_labels, vec!["white", "red", "blue"]);
}

#[tokio::test]
async fn test_list_annotations_by_image() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        Some("scan.png"),
        512,
        512,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    set_annotations(
        &mut db,
        "img-001",
        vec![AnnotationInput {
            id: "a1".to_string(),
            label_id: label.id,
            boxes: vec![BoxInput {
                id: "b1".to_string(),
                box_type: BoxType::Annotate,
                x1: 0.0,
                y1: 0.0,
                x2: 100.0,
                y2: 100.0,
            }],
            points: vec![PointInput {
                id: "p1".to_string(),
                x: 50.0,
                y: 50.0,
                sign: PointSign::Positive,
            }],
        }],
    )
    .await
    .unwrap();

    let annos = list_annotations_by_image(&mut db, "img-001").await.unwrap();
    assert_eq!(annos.len(), 1);
    assert_eq!(annos[0].id, "a1");
    assert_eq!(annos[0].label_id, label.id);
    assert_eq!(annos[0].boxes.len(), 1);
    assert_eq!(annos[0].boxes[0].id, "b1");
    assert_eq!(annos[0].boxes[0].box_type, BoxType::Annotate);
    assert_eq!(annos[0].points.len(), 1);
    assert_eq!(annos[0].points[0].id, "p1");
    assert_eq!(annos[0].points[0].sign, PointSign::Positive);

    let empty = list_annotations_by_image(&mut db, "img-empty").await.unwrap();
    assert!(empty.is_empty());
}

#[tokio::test]
async fn test_list_annotation_counts() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    db::ops::volume_ops::create_or_get_volume(&mut db, "vol-001", 512, 512, 10, "uint8", "little", "axial")
        .await
        .unwrap();

    for i in 0..5 {
        image_ops::upsert_image(
            &mut db,
            &format!("slice-{i}"),
            None,
            100,
            100,
            ImageType::Slice,
            Some("vol-001"),
            Some(i),
            None,
        )
        .await
        .unwrap();
    }

    set_annotations(
        &mut db,
        "slice-0",
        vec![AnnotationInput {
            id: "a-0".to_string(),
            label_id: label.id,
            boxes: vec![],
            points: vec![PointInput {
                id: "p-0".to_string(),
                x: 10.0,
                y: 10.0,
                sign: PointSign::Positive,
            }],
        }],
    )
    .await
    .unwrap();

    set_annotations(
        &mut db,
        "slice-2",
        vec![
            AnnotationInput {
                id: "a-2a".to_string(),
                label_id: label.id,
                boxes: vec![],
                points: vec![PointInput {
                    id: "p-2a".to_string(),
                    x: 10.0,
                    y: 10.0,
                    sign: PointSign::Negative,
                }],
            },
            AnnotationInput {
                id: "a-2b".to_string(),
                label_id: label.id,
                boxes: vec![],
                points: vec![PointInput {
                    id: "p-2b".to_string(),
                    x: 20.0,
                    y: 20.0,
                    sign: PointSign::Positive,
                }],
            },
        ],
    )
    .await
    .unwrap();

    let counts = list_annotation_counts(&mut db, "vol-001").await.unwrap();

    assert_eq!(counts.len(), 2);
    let c0 = &counts[0];
    assert_eq!(c0.image_hash, "slice-0");
    assert_eq!(c0.slice_index, Some(0));
    assert_eq!(c0.annotation_count, 1);

    let c1 = &counts[1];
    assert_eq!(c1.image_hash, "slice-2");
    assert_eq!(c1.slice_index, Some(2));
    assert_eq!(c1.annotation_count, 2);

    let no_annotations = list_annotation_counts(&mut db, "vol-missing").await.unwrap();
    assert!(no_annotations.is_empty());
}
