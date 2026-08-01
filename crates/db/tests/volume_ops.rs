mod common;

use db::ops::volume_ops;

#[tokio::test]
async fn test_create_or_get_volume() {
    let mut db = common::setup_db().await;
    let vol = volume_ops::create_or_get_volume(&mut db, "vol-001", 512, 512, 100, "uint8", "little", "axial")
        .await
        .unwrap();

    assert_eq!(vol.id, "vol-001");
    assert_eq!(vol.x, 512);
    assert_eq!(vol.y, 512);
    assert_eq!(vol.z, 100);
    assert_eq!(vol.dtype, "uint8");
    assert_eq!(vol.endian, "little");
    assert_eq!(vol.axis, "axial");
}

#[tokio::test]
async fn test_create_or_get_volume_existing() {
    let mut db = common::setup_db().await;
    let vol1 = volume_ops::create_or_get_volume(&mut db, "vol-001", 512, 512, 100, "uint8", "little", "axial")
        .await
        .unwrap();
    let vol2 = volume_ops::create_or_get_volume(&mut db, "vol-001", 256, 256, 50, "float32", "big", "coronal")
        .await
        .unwrap();

    assert_eq!(vol1.id, vol2.id);
    assert_eq!(vol2.x, 512);
    assert_eq!(vol2.dtype, "uint8");
}

#[tokio::test]
async fn test_get_volume() {
    let mut db = common::setup_db().await;
    volume_ops::create_or_get_volume(&mut db, "vol-001", 512, 512, 100, "uint8", "little", "axial")
        .await
        .unwrap();

    let vol = volume_ops::get_volume(&mut db, "vol-001").await.unwrap();
    assert!(vol.is_some());
    assert_eq!(vol.unwrap().id, "vol-001");
}

#[tokio::test]
async fn test_get_volume_not_found() {
    let mut db = common::setup_db().await;
    let vol = volume_ops::get_volume(&mut db, "nonexistent").await.unwrap();
    assert!(vol.is_none());
}

#[tokio::test]
async fn test_delete_volume() {
    let mut db = common::setup_db().await;
    volume_ops::create_or_get_volume(&mut db, "vol-001", 512, 512, 100, "uint8", "little", "axial")
        .await
        .unwrap();

    volume_ops::delete_volume(&mut db, "vol-001").await.unwrap();

    let vol = volume_ops::get_volume(&mut db, "vol-001").await.unwrap();
    assert!(vol.is_none());
}
