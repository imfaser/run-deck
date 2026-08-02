mod common;

use db::ops::label_ops;

#[tokio::test]
async fn test_create_label() {
    let mut db = common::setup_db().await;
    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    assert_eq!(label.name, "tumor");
    assert_eq!(label.color, "#ff0000");
    assert_eq!(label.order, 1);
    assert!(label.sub_labels.is_empty());
}

#[tokio::test]
async fn test_list_labels() {
    let mut db = common::setup_db().await;
    label_ops::create_label(&mut db, "a", "#000", 1, vec![])
        .await
        .unwrap();
    label_ops::create_label(&mut db, "b", "#111", 2, vec![])
        .await
        .unwrap();
    label_ops::create_label(&mut db, "c", "#222", 3, vec![])
        .await
        .unwrap();

    let labels = label_ops::list_labels(&mut db).await.unwrap();
    assert_eq!(labels.len(), 3);
}

#[tokio::test]
async fn test_update_label() {
    let mut db = common::setup_db().await;
    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    let updated = label_ops::update_label(&mut db, label.id, Some("necrosis"), None, None, None)
        .await
        .unwrap();
    assert_eq!(updated.name, "necrosis");
    assert_eq!(updated.color, "#ff0000");
    assert_eq!(updated.order, 1);

    let updated = label_ops::update_label(&mut db, label.id, None, Some("#00ff00"), None, None)
        .await
        .unwrap();
    assert_eq!(updated.name, "necrosis");
    assert_eq!(updated.color, "#00ff00");
    assert_eq!(updated.order, 1);

    let updated = label_ops::update_label(&mut db, label.id, None, None, Some(5), None)
        .await
        .unwrap();
    assert_eq!(updated.name, "necrosis");
    assert_eq!(updated.color, "#00ff00");
    assert_eq!(updated.order, 5);
}

#[tokio::test]
async fn test_update_label_sub_labels() {
    let mut db = common::setup_db().await;
    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    let updated = label_ops::update_label(
        &mut db,
        label.id,
        None,
        None,
        None,
        Some(vec!["necrosis".to_string(), "calcification".to_string()]),
    )
    .await
    .unwrap();
    assert_eq!(updated.sub_labels, vec!["necrosis", "calcification"]);
}

#[tokio::test]
async fn test_reorder_labels() {
    let mut db = common::setup_db().await;
    let l1 = label_ops::create_label(&mut db, "a", "#000", 1, vec![])
        .await
        .unwrap();
    let l2 = label_ops::create_label(&mut db, "b", "#111", 2, vec![])
        .await
        .unwrap();
    let l3 = label_ops::create_label(&mut db, "c", "#222", 3, vec![])
        .await
        .unwrap();

    label_ops::reorder_labels(&mut db, vec![(l1.id, 3), (l2.id, 1), (l3.id, 2)])
        .await
        .unwrap();

    let labels = label_ops::list_labels(&mut db).await.unwrap();
    let l1_ref = labels.iter().find(|l| l.id == l1.id).unwrap();
    let l2_ref = labels.iter().find(|l| l.id == l2.id).unwrap();
    let l3_ref = labels.iter().find(|l| l.id == l3.id).unwrap();

    assert_eq!(l1_ref.order, 3);
    assert_eq!(l2_ref.order, 1);
    assert_eq!(l3_ref.order, 2);
}

#[tokio::test]
async fn test_delete_label() {
    let mut db = common::setup_db().await;
    let label = label_ops::create_label(&mut db, "tumor", "#ff0000", 1, vec![])
        .await
        .unwrap();

    label_ops::delete_label(&mut db, label.id).await.unwrap();

    let labels = label_ops::list_labels(&mut db).await.unwrap();
    assert!(labels.is_empty());
}

#[tokio::test]
async fn test_create_label_rejects_order_zero() {
    let mut db = common::setup_db().await;
    let err = label_ops::create_label(&mut db, "tumor", "#ff0000", 0, vec![])
        .await
        .unwrap_err();
    assert!(err.to_string().contains("order 必须大于等于 1"));
}

#[tokio::test]
async fn test_create_label_duplicate_order_conflicts() {
    let mut db = common::setup_db().await;
    label_ops::create_label(&mut db, "a", "#000", 1, vec![])
        .await
        .unwrap();
    let err = label_ops::create_label(&mut db, "b", "#111", 1, vec![])
        .await
        .unwrap_err();
    assert!(err.to_string().contains("UNIQUE") || err.to_string().contains("unique"));
}

#[tokio::test]
async fn test_reorder_labels_swap_orders() {
    let mut db = common::setup_db().await;
    let l1 = label_ops::create_label(&mut db, "a", "#000", 1, vec![])
        .await
        .unwrap();
    let l2 = label_ops::create_label(&mut db, "b", "#111", 2, vec![])
        .await
        .unwrap();

    label_ops::reorder_labels(&mut db, vec![(l1.id, 2), (l2.id, 1)])
        .await
        .unwrap();

    let labels = label_ops::list_labels(&mut db).await.unwrap();
    let l1_ref = labels.iter().find(|l| l.id == l1.id).unwrap();
    let l2_ref = labels.iter().find(|l| l.id == l2.id).unwrap();
    assert_eq!(l1_ref.order, 2);
    assert_eq!(l2_ref.order, 1);
}

#[tokio::test]
async fn test_reorder_labels_rejects_order_zero() {
    let mut db = common::setup_db().await;
    let l1 = label_ops::create_label(&mut db, "a", "#000", 1, vec![])
        .await
        .unwrap();
    let err = label_ops::reorder_labels(&mut db, vec![(l1.id, 0)])
        .await
        .unwrap_err();
    assert!(err.to_string().contains("order 必须大于等于 1"));
}
