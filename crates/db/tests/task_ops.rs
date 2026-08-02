mod common;

use db::models::task::{TaskKind, TaskParams, TaskStatus};
use db::ops::task_ops::{
    TaskCreateInput, TaskPatch, create_task, delete_task, fail_task, get_task_by_id,
    has_running_task, list_tasks, reorder_tasks, reset_for_run, set_task_status, update_task,
};

fn params() -> TaskParams {
    TaskParams {
        use_prev_mask: true,
        targets: vec![],
    }
}

fn input(name: &str, kind: TaskKind, range_start: i32, range_end: i32) -> TaskCreateInput {
    TaskCreateInput {
        name: name.to_string(),
        kind,
        volume_id: "vol-001".to_string(),
        range_start,
        range_end,
        params: params(),
    }
}

#[tokio::test]
async fn test_create_task() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("seg", TaskKind::Segment, 0, 10))
        .await
        .unwrap();

    assert_eq!(task.name, "seg");
    assert_eq!(task.kind, TaskKind::Segment);
    assert_eq!(task.status, TaskStatus::Pending);
    assert!(task.enabled);
    assert_eq!(task.order, 1);
    assert_eq!(task.volume_id, "vol-001");
    assert_eq!(task.range_end, 10);
    assert_eq!(task.params.use_prev_mask, true);
    assert!(task.created_at > 0);
}

#[tokio::test]
async fn test_create_task_auto_increments_order() {
    let mut db = common::setup_db().await;
    let t1 = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    let t2 = create_task(&mut db, input("b", TaskKind::Detect, 0, 1))
        .await
        .unwrap();
    assert_eq!(t1.order, 1);
    assert_eq!(t2.order, 2);
}

#[tokio::test]
async fn test_create_task_invalid_range() {
    let mut db = common::setup_db().await;
    assert!(create_task(&mut db, input("bad", TaskKind::Segment, 5, 2)).await.is_err());
}

#[tokio::test]
async fn test_list_tasks_ordered() {
    let mut db = common::setup_db().await;
    let t1 = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    let t2 = create_task(&mut db, input("b", TaskKind::Detect, 0, 1))
        .await
        .unwrap();

    reorder_tasks(&mut db, vec![(t2.id, 1), (t1.id, 2)]).await.unwrap();

    let tasks = list_tasks(&mut db).await.unwrap();
    assert_eq!(tasks.len(), 2);
    assert_eq!(tasks[0].id, t2.id);
    assert_eq!(tasks[1].id, t1.id);
}

#[tokio::test]
async fn test_update_task() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();

    let updated = update_task(
        &mut db,
        task.id,
        TaskPatch {
            name: Some("renamed".to_string()),
            enabled: Some(false),
            range_end: Some(5),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.name, "renamed");
    assert!(!updated.enabled);
    assert_eq!(updated.range_end, 5);
}

#[tokio::test]
async fn test_update_task_rejects_running() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    set_task_status(&mut db, task.id, TaskStatus::Running).await.unwrap();

    let result = update_task(
        &mut db,
        task.id,
        TaskPatch {
            name: Some("x".to_string()),
            ..Default::default()
        },
    )
    .await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_has_running_task() {
    let mut db = common::setup_db().await;
    assert!(!has_running_task(&mut db).await.unwrap());

    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    set_task_status(&mut db, task.id, TaskStatus::Running).await.unwrap();

    assert!(has_running_task(&mut db).await.unwrap());
}

#[tokio::test]
async fn test_delete_task() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    delete_task(&mut db, task.id).await.unwrap();

    let tasks = list_tasks(&mut db).await.unwrap();
    assert!(tasks.is_empty());
}

#[tokio::test]
async fn test_params_json_roundtrip() {
    let mut db = common::setup_db().await;
    let mut p = params();
    p.targets.push(db::models::task::DetectTarget {
        label_id: uuid::Uuid::new_v4(),
        sub_labels: vec!["nucleus".to_string()],
    });
    let task = create_task(
        &mut db,
        TaskCreateInput {
            name: "det".to_string(),
            kind: TaskKind::Detect,
            volume_id: "v".to_string(),
            range_start: 0,
            range_end: 3,
            params: p.clone(),
        },
    )
    .await
    .unwrap();

    let tasks = list_tasks(&mut db).await.unwrap();
    assert_eq!(tasks[0].params.targets.len(), 1);
    assert_eq!(tasks[0].params.targets[0].sub_labels[0], "nucleus");
    let _ = task;
}

#[tokio::test]
async fn test_fail_task() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    set_task_status(&mut db, task.id, TaskStatus::Running)
        .await
        .unwrap();

    fail_task(&mut db, task.id, "MCP timeout".to_string())
        .await
        .unwrap();

    let updated = get_task_by_id(&mut db, task.id).await.unwrap().unwrap();
    assert_eq!(updated.status, TaskStatus::Failed);
    assert_eq!(updated.error.as_deref(), Some("MCP timeout"));
}

#[tokio::test]
async fn test_reset_for_run() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 10))
        .await
        .unwrap();
    set_task_status(&mut db, task.id, TaskStatus::Running)
        .await
        .unwrap();
    fail_task(&mut db, task.id, "some error".to_string())
        .await
        .unwrap();

    reset_for_run(&mut db, task.id).await.unwrap();

    let updated = get_task_by_id(&mut db, task.id).await.unwrap().unwrap();
    assert_eq!(updated.status, TaskStatus::Pending);
    assert!(updated.error.is_none());
    assert_eq!(updated.progress_current, 0);
    assert_eq!(updated.progress_total, 0);
}

#[tokio::test]
async fn test_next_order_starts_at_1() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("first", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    assert_eq!(task.order, 1);
}

#[tokio::test]
async fn test_next_order_after_delete() {
    let mut db = common::setup_db().await;
    let t1 = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    assert_eq!(t1.order, 1);
    delete_task(&mut db, t1.id).await.unwrap();

    // After deleting the only task, max order is 0, next is 1
    let t2 = create_task(&mut db, input("b", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    assert_eq!(t2.order, 1);
}

#[tokio::test]
async fn test_next_order_with_existing_tasks() {
    let mut db = common::setup_db().await;
    let t1 = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    assert_eq!(t1.order, 1);
    let t2 = create_task(&mut db, input("b", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    assert_eq!(t2.order, 2);

    // Delete the first, still have order=2 → next is 3
    delete_task(&mut db, t1.id).await.unwrap();
    let t3 = create_task(&mut db, input("c", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    assert_eq!(t3.order, 3);
}

#[tokio::test]
async fn test_delete_running_task_cancels() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    set_task_status(&mut db, task.id, TaskStatus::Running)
        .await
        .unwrap();

    delete_task(&mut db, task.id).await.unwrap();

    let tasks = list_tasks(&mut db).await.unwrap();
    assert!(tasks.is_empty());
}

#[tokio::test]
async fn test_reorder_tasks_same_order() {
    let mut db = common::setup_db().await;
    let t1 = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    let t2 = create_task(&mut db, input("b", TaskKind::Detect, 0, 1))
        .await
        .unwrap();

    // Both set to order 1 — should succeed (no uniqueness constraint on order)
    reorder_tasks(&mut db, vec![(t1.id, 1), (t2.id, 1)])
        .await
        .unwrap();

    let tasks = list_tasks(&mut db).await.unwrap();
    // list_tasks sorts by (order, created_at), both have order=1
    assert_eq!(tasks.len(), 2);
    // t1 was created first, so it comes first
    assert_eq!(tasks[0].id, t1.id);
    assert_eq!(tasks[1].id, t2.id);
}

#[tokio::test]
async fn test_update_task_range() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 10))
        .await
        .unwrap();

    let updated = update_task(
        &mut db,
        task.id,
        TaskPatch {
            range_start: Some(3),
            range_end: Some(7),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert_eq!(updated.range_start, 3);
    assert_eq!(updated.range_end, 7);
}

#[tokio::test]
async fn test_update_task_params() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();

    let new_params = TaskParams {
        use_prev_mask: false,
        targets: vec![db::models::task::DetectTarget {
            label_id: uuid::Uuid::new_v4(),
            sub_labels: vec!["test".to_string()],
        }],
    };

    let updated = update_task(
        &mut db,
        task.id,
        TaskPatch {
            params: Some(new_params),
            ..Default::default()
        },
    )
    .await
    .unwrap();

    assert!(!updated.params.use_prev_mask);
    assert_eq!(updated.params.targets.len(), 1);
}

#[tokio::test]
async fn test_reorder_tasks_nonexistent_task_rollback() {
    let mut db = common::setup_db().await;
    let t1 = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    let t2 = create_task(&mut db, input("b", TaskKind::Segment, 0, 1))
        .await
        .unwrap();

    let fake_id = uuid::Uuid::new_v4();
    let result = reorder_tasks(&mut db, vec![(t1.id, 2), (fake_id, 3), (t2.id, 1)]).await;
    assert!(result.is_err());

    // Transaction should have rolled back: t1 still has original order
    let tasks = list_tasks(&mut db).await.unwrap();
    assert_eq!(tasks.len(), 2);
    let t1_refetched = tasks.iter().find(|t| t.id == t1.id).unwrap();
    assert_eq!(t1_refetched.order, 1); // unchanged — rollback worked
}

#[tokio::test]
async fn test_reorder_tasks_rejects_order_below_one() {
    let mut db = common::setup_db().await;
    let t1 = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();

    let result = reorder_tasks(&mut db, vec![(t1.id, 0)]).await;
    assert!(result.is_err());
    let err_msg = format!("{}", result.unwrap_err());
    assert!(err_msg.contains("order"));
}

#[tokio::test]
async fn test_next_order_with_gaps() {
    let mut db = common::setup_db().await;
    let t1 = create_task(&mut db, input("a", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    let t2 = create_task(&mut db, input("b", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    let t3 = create_task(&mut db, input("c", TaskKind::Segment, 0, 1))
        .await
        .unwrap();

    // Set orders to 1, 5, 10
    reorder_tasks(
        &mut db,
        vec![(t1.id, 1), (t2.id, 5), (t3.id, 10)],
    )
    .await
    .unwrap();

    // Delete middle task (order=5)
    delete_task(&mut db, t2.id).await.unwrap();

    // next_order should be 11 (max=10 + 1), not 6 (gap-filling)
    let t4 = create_task(&mut db, input("d", TaskKind::Segment, 0, 1))
        .await
        .unwrap();
    assert_eq!(t4.order, 11);
}

#[tokio::test]
async fn test_create_task_boundary_range() {
    let mut db = common::setup_db().await;

    // range_start == range_end (single slice)
    let task = create_task(&mut db, input("single", TaskKind::Segment, 5, 5))
        .await
        .unwrap();
    assert_eq!(task.range_start, 5);
    assert_eq!(task.range_end, 5);
}

#[tokio::test]
async fn test_create_task_zero_range() {
    let mut db = common::setup_db().await;
    let task = create_task(&mut db, input("zero", TaskKind::Segment, 0, 0))
        .await
        .unwrap();
    assert_eq!(task.range_start, 0);
    assert_eq!(task.range_end, 0);
}
