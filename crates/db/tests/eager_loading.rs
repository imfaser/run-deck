mod common;

use db::ops::annotation_ops::{set_annotations, AnnotationInput, BoxInput, PointInput};
use db::models::annotation::{BoxType, PointSign};
use db::models::image::ImageType;
use db::ops::{image_ops, label_ops};

#[tokio::test]
async fn test_get_by_hash_eager_loads_annotations() {
    let mut db = common::setup_db().await;

    // Create label
    let label = label_ops::create_label(&mut db, "test-label", "#ff0000", 1, vec![])
        .await
        .unwrap();

    // Create image
    let img = image_ops::upsert_image(
        &mut db,
        "hash-eager",
        Some("test.png"),
        512,
        512,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();
    assert_eq!(img.annotations.len(), 0);

    // Set annotations with box and point
    let img = set_annotations(
        &mut db,
        "hash-eager",
        vec![AnnotationInput {
            id: "anno-1".to_string(),
            label_id: label.id,
            boxes: vec![
                BoxInput {
                    id: "box-1".to_string(),
                    box_type: BoxType::Annotate,
                    x1: 0.0,
                    y1: 0.0,
                    x2: 100.0,
                    y2: 100.0,
                },
                BoxInput {
                    id: "box-2".to_string(),
                    box_type: BoxType::Visual,
                    x1: 200.0,
                    y1: 200.0,
                    x2: 300.0,
                    y2: 300.0,
                },
            ],
            points: vec![
                PointInput {
                    id: "pt-1".to_string(),
                    x: 50.0,
                    y: 50.0,
                    sign: PointSign::Positive,
                },
                PointInput {
                    id: "pt-2".to_string(),
                    x: 150.0,
                    y: 150.0,
                    sign: PointSign::Negative,
                },
            ],
        }],
    )
    .await
    .unwrap();

    // Verify eager loading
    assert_eq!(img.annotations.len(), 1);

    let anno = &img.annotations[0];
    assert_eq!(anno.boxes.len(), 2);
    assert_eq!(anno.points.len(), 2);

    // Verify box details (find by id to avoid ordering issues)
    let box1 = anno.boxes.iter().find(|b| b.id == "box-1").unwrap();
    assert_eq!(box1.box_type, BoxType::Annotate);
    assert_eq!(box1.x1, 0.0);
    assert_eq!(box1.x2, 100.0);

    let box2 = anno.boxes.iter().find(|b| b.id == "box-2").unwrap();
    assert_eq!(box2.box_type, BoxType::Visual);
    assert_eq!(box2.x1, 200.0);
    assert_eq!(box2.x2, 300.0);

    // Verify point details (find by id)
    let pt1 = anno.points.iter().find(|p| p.id == "pt-1").unwrap();
    assert_eq!(pt1.sign, PointSign::Positive);
    assert_eq!(pt1.x, 50.0);
    assert_eq!(pt1.y, 50.0);

    let pt2 = anno.points.iter().find(|p| p.id == "pt-2").unwrap();
    assert_eq!(pt2.sign, PointSign::Negative);
    assert_eq!(pt2.x, 150.0);
    assert_eq!(pt2.y, 150.0);

    // Verify get_by_hash also returns the same data
    let img2 = image_ops::get_image_by_hash(&mut db, "hash-eager")
        .await
        .unwrap()
        .expect("image should exist");
    assert_eq!(img2.annotations.len(), 1);
    assert_eq!(img2.annotations[0].boxes.len(), 2);
    assert_eq!(img2.annotations[0].points.len(), 2);
}
