mod common;

use db::ops::annotation_ops::{set_annotations, AnnotationInput, BoxInput, PointInput};
use db::models::annotation::{BoxType, PointSign};
use db::models::image::ImageType;
use db::ops::{image_ops, label_ops};

#[tokio::test]
async fn test_delete_label_cascade() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();
    let other_label = label_ops::create_label(&mut db, "stroma", "#00ff00", 2, vec![])
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
        vec![
            AnnotationInput {
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
            },
            AnnotationInput {
                id: "a2".to_string(),
                label_id: other_label.id,
                boxes: vec![],
                points: vec![],
            },
        ],
    )
    .await
    .unwrap();

    label_ops::delete_label(&mut db, label.id).await.unwrap();

    let labels = label_ops::list_labels(&mut db).await.unwrap();
    assert_eq!(labels.len(), 1);
    assert_eq!(labels[0].id, other_label.id);

    let img = image_ops::get_image_by_hash(&mut db, "img-001")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(img.annotations.len(), 1);
    assert_eq!(img.annotations[0].label_id, other_label.id);
}

#[tokio::test]
async fn test_delete_image_cascade() {
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

    image_ops::delete_image(&mut db, "img-001").await.unwrap();

    let img = image_ops::get_image_by_hash(&mut db, "img-001")
        .await
        .unwrap();
    assert!(img.is_none());
}

#[tokio::test]
async fn test_delete_volume_independent() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    db::ops::volume_ops::create_or_get_volume(&mut db, "vol-001", 512, 512, 100, "uint8", "little", "axial")
        .await
        .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        None,
        100,
        100,
        ImageType::Slice,
        Some("vol-001"),
        Some(0),
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
            boxes: vec![],
            points: vec![],
        }],
    )
    .await
    .unwrap();

    db::ops::volume_ops::delete_volume(&mut db, "vol-001").await.unwrap();

    let vol = db::ops::volume_ops::get_volume(&mut db, "vol-001").await.unwrap();
    assert!(vol.is_none());

    let img = image_ops::get_image_by_hash(&mut db, "img-001")
        .await
        .unwrap();
    assert!(img.is_some());
    assert_eq!(img.unwrap().volume_id, Some("vol-001".to_string()));
}

#[tokio::test]
async fn test_delete_volume_cascade() {
    let mut db = common::setup_db().await;

    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    db::ops::volume_ops::create_or_get_volume(
        &mut db,
        "vol-001",
        512,
        512,
        100,
        "uint8",
        "little",
        "axial",
    )
    .await
    .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-001",
        None,
        100,
        100,
        ImageType::Slice,
        Some("vol-001"),
        Some(0),
        None,
    )
    .await
    .unwrap();
    image_ops::upsert_image(
        &mut db,
        "img-002",
        None,
        100,
        100,
        ImageType::Slice,
        Some("vol-001"),
        Some(1),
        None,
    )
    .await
    .unwrap();

    for (hash, id) in [("img-001", "a1"), ("img-002", "a2")] {
        set_annotations(
            &mut db,
            hash,
            vec![AnnotationInput {
                id: id.to_string(),
                label_id: label.id,
                boxes: vec![BoxInput {
                    id: format!("{id}-box"),
                    box_type: BoxType::Annotate,
                    x1: 0.0,
                    y1: 0.0,
                    x2: 100.0,
                    y2: 100.0,
                }],
                points: vec![PointInput {
                    id: format!("{id}-point"),
                    x: 50.0,
                    y: 50.0,
                    sign: PointSign::Positive,
                }],
            }],
        )
        .await
        .unwrap();
    }

    db::ops::volume_ops::delete_volume_cascade(&mut db, "vol-001")
        .await
        .unwrap();

    let vol = db::ops::volume_ops::get_volume(&mut db, "vol-001").await.unwrap();
    assert!(vol.is_none());

    let img1 = image_ops::get_image_by_hash(&mut db, "img-001").await.unwrap();
    let img2 = image_ops::get_image_by_hash(&mut db, "img-002").await.unwrap();
    assert!(img1.is_none());
    assert!(img2.is_none());

    let annos = db::ops::annotation_ops::list_annotations_by_image(&mut db, "img-001")
        .await
        .unwrap();
    assert!(annos.is_empty());
}

#[tokio::test]
async fn test_delete_volume_cascade_no_images() {
    let mut db = common::setup_db().await;

    db::ops::volume_ops::create_or_get_volume(
        &mut db,
        "vol-empty",
        512,
        512,
        10,
        "uint8",
        "little",
        "axial",
    )
    .await
    .unwrap();

    db::ops::volume_ops::delete_volume_cascade(&mut db, "vol-empty")
        .await
        .unwrap();

    let vol = db::ops::volume_ops::get_volume(&mut db, "vol-empty")
        .await
        .unwrap();
    assert!(vol.is_none());
}

#[tokio::test]
async fn test_delete_volume_cascade_images_no_annotations() {
    let mut db = common::setup_db().await;

    db::ops::volume_ops::create_or_get_volume(
        &mut db,
        "vol-001",
        512,
        512,
        100,
        "uint8",
        "little",
        "axial",
    )
    .await
    .unwrap();

    image_ops::upsert_image(
        &mut db,
        "img-no-annos",
        None,
        100,
        100,
        ImageType::Slice,
        Some("vol-001"),
        Some(0),
        None,
    )
    .await
    .unwrap();

    db::ops::volume_ops::delete_volume_cascade(&mut db, "vol-001")
        .await
        .unwrap();

    let vol = db::ops::volume_ops::get_volume(&mut db, "vol-001")
        .await
        .unwrap();
    assert!(vol.is_none());

    let img = image_ops::get_image_by_hash(&mut db, "img-no-annos")
        .await
        .unwrap();
    assert!(img.is_none());
}

#[tokio::test]
async fn test_delete_volume_cascade_nonexistent_volume() {
    let mut db = common::setup_db().await;

    let result = db::ops::volume_ops::delete_volume_cascade(&mut db, "nonexistent-vol").await;
    assert!(result.is_err());
}
