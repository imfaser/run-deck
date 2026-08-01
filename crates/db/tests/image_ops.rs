mod common;

use db::models::image::ImageType;
use db::ops::image_ops;

#[tokio::test]
async fn test_upsert_image_2d() {
    let mut db = common::setup_db().await;
    let img = image_ops::upsert_image(
        &mut db,
        "abc123",
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

    assert_eq!(img.hash, "abc123");
    assert_eq!(img.image_name, Some("test.png".to_string()));
    assert_eq!(img.width, 512);
    assert_eq!(img.height, 512);
    assert_eq!(img.slice_index, None);
    assert!(img.annotations.is_empty());
}

#[tokio::test]
async fn test_upsert_image_3d() {
    let mut db = common::setup_db().await;
    let img = image_ops::upsert_image(
        &mut db,
        "def456",
        None,
        256,
        256,
        ImageType::Slice,
        Some("vol-001"),
        Some(42),
        None,
    )
    .await
    .unwrap();

    assert_eq!(img.hash, "def456");
    assert!(img.image_name.is_none());
    assert_eq!(img.slice_index, Some(42));
    assert_eq!(img.volume_id, Some("vol-001".to_string()));
}

#[tokio::test]
async fn test_upsert_image_validation() {
    let mut db = common::setup_db().await;
    let result = image_ops::upsert_image(
        &mut db,
        "bad",
        None,
        100,
        100,
        ImageType::File,
        None,
        None,
        None,
    )
    .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_upsert_image_update_existing() {
    let mut db = common::setup_db().await;
    image_ops::upsert_image(
        &mut db,
        "hash1",
        Some("old.png"),
        100,
        100,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let img = image_ops::upsert_image(
        &mut db,
        "hash1",
        Some("new.png"),
        200,
        200,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    assert_eq!(img.width, 200);
    assert_eq!(img.height, 200);
    assert_eq!(img.image_name, Some("new.png".to_string()));
}

#[tokio::test]
async fn test_get_image_by_hash() {
    let mut db = common::setup_db().await;
    image_ops::upsert_image(
        &mut db,
        "hash1",
        Some("test.png"),
        100,
        100,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let img = image_ops::get_image_by_hash(&mut db, "hash1").await.unwrap();
    assert!(img.is_some());
    assert_eq!(img.unwrap().hash, "hash1");
}

#[tokio::test]
async fn test_get_image_by_hash_not_found() {
    let mut db = common::setup_db().await;
    let img = image_ops::get_image_by_hash(&mut db, "nonexistent")
        .await
        .unwrap();
    assert!(img.is_none());
}

#[tokio::test]
async fn test_get_image_by_name() {
    let mut db = common::setup_db().await;
    image_ops::upsert_image(
        &mut db,
        "hash1",
        Some("unique_name.png"),
        100,
        100,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let img = image_ops::get_image_by_name(&mut db, "unique_name.png")
        .await
        .unwrap();
    assert!(img.is_some());
    assert_eq!(img.unwrap().hash, "hash1");
}

#[tokio::test]
async fn test_list_images_by_volume() {
    let mut db = common::setup_db().await;
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

    let images = image_ops::list_images_by_volume(&mut db, "vol-001")
        .await
        .unwrap();
    assert_eq!(images.len(), 5);
    assert_eq!(images[0].slice_index, Some(0));
    assert_eq!(images[4].slice_index, Some(4));
}

#[tokio::test]
async fn test_delete_image() {
    let mut db = common::setup_db().await;
    image_ops::upsert_image(
        &mut db,
        "hash1",
        Some("test.png"),
        100,
        100,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    image_ops::delete_image(&mut db, "hash1").await.unwrap();

    let img = image_ops::get_image_by_hash(&mut db, "hash1").await.unwrap();
    assert!(img.is_none());
}

#[tokio::test]
async fn test_delete_images_by_volume() {
    let mut db = common::setup_db().await;
    for i in 0..3 {
        image_ops::upsert_image(
            &mut db,
            &format!("slice-{i}"),
            None,
            100,
            100,
            ImageType::Slice,
            Some("vol-del"),
            Some(i),
            None,
        )
        .await
        .unwrap();
    }

    image_ops::delete_images_by_volume(&mut db, "vol-del")
        .await
        .unwrap();

    let images = image_ops::list_images_by_volume(&mut db, "vol-del")
        .await
        .unwrap();
    assert!(images.is_empty());
}

#[tokio::test]
async fn test_update_mask_hash() {
    let mut db = common::setup_db().await;
    image_ops::upsert_image(
        &mut db,
        "hash1",
        Some("test.png"),
        100,
        100,
        ImageType::File,
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let img = image_ops::update_mask_hash(&mut db, "hash1", Some("mask-abc"))
        .await
        .unwrap();
    assert_eq!(img.mask_hash, Some("mask-abc".to_string()));

    let img = image_ops::update_mask_hash(&mut db, "hash1", None)
        .await
        .unwrap();
    assert!(img.mask_hash.is_none());
}
