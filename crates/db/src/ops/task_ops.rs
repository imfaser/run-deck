use anyhow::{Result, bail};

use crate::models::task::{Task, TaskKind, TaskParams, TaskStatus};

/// 创建任务的输入。
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskCreateInput {
    pub name: String,
    pub kind: TaskKind,
    pub volume_id: String,
    pub range_start: i32,
    pub range_end: i32,
    pub params: TaskParams,
}

/// 更新任务的补丁（仅更新提供的字段）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPatch {
    pub name: Option<String>,
    pub enabled: Option<bool>,
    pub order: Option<i32>,
    pub range_start: Option<i32>,
    pub range_end: Option<i32>,
    pub params: Option<TaskParams>,
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| i64::try_from(d.as_millis()).unwrap_or(0))
        .unwrap_or(0)
}

pub async fn create_task(db: &mut toasty::Db, input: TaskCreateInput) -> Result<Task> {
    if input.range_start < 0 || input.range_end < input.range_start {
        bail!("range_start/range_end 非法: {}..{}", input.range_start, input.range_end);
    }
    let now = now_ms();
    let order = next_order(db).await?;
    let task = toasty::create!(Task {
        name: input.name,
        kind: input.kind,
        status: TaskStatus::Pending,
        enabled: true,
        order,
        volume_id: input.volume_id,
        range_start: input.range_start,
        range_end: input.range_end,
        params: input.params,
        error: None,
        progress_current: 0,
        progress_total: 0,
        created_at: now,
        updated_at: now,
    })
    .exec(db)
    .await?;
    Ok(task)
}

async fn next_order(db: &mut toasty::Db) -> Result<i32> {
    let max = Task::all()
        .order_by(Task::fields().order().desc())
        .first()
        .exec(db)
        .await?
        .map(|t| t.order)
        .unwrap_or(0);
    Ok(max + 1)
}

/// 按 `order` 升序返回全部任务。
pub async fn list_tasks(db: &mut toasty::Db) -> Result<Vec<Task>> {
    let mut tasks = Task::all().exec(db).await?;
    tasks.sort_by_key(|t| (t.order, t.created_at));
    Ok(tasks)
}

pub async fn get_task_by_id(db: &mut toasty::Db, id: uuid::Uuid) -> Result<Option<Task>> {
    match Task::get_by_id(db, &id).await {
        Ok(task) => Ok(Some(task)),
        Err(_) => Ok(None),
    }
}

/// 是否存在 Running 任务。
pub async fn has_running_task(db: &mut toasty::Db) -> Result<bool> {
    let task = Task::filter(Task::fields().status().eq(TaskStatus::Running))
        .first()
        .exec(db)
        .await?;
    Ok(task.is_some())
}

pub async fn update_task(db: &mut toasty::Db, id: uuid::Uuid, patch: TaskPatch) -> Result<Task> {
    let mut task = Task::get_by_id(db, &id).await?;
    if matches!(task.status, TaskStatus::Running) {
        bail!("任务运行中，无法编辑");
    }

    let mut update = task.update().updated_at(now_ms());
    if let Some(name) = patch.name {
        update = update.name(name);
    }
    if let Some(enabled) = patch.enabled {
        update = update.enabled(enabled);
    }
    if let Some(order) = patch.order {
        update = update.order(order);
    }
    if let Some(rs) = patch.range_start {
        update = update.range_start(rs);
    }
    if let Some(re) = patch.range_end {
        update = update.range_end(re);
    }
    if let Some(params) = patch.params {
        update = update.params(params);
    }
    update.exec(db).await?;

    task = Task::get_by_id(db, &id).await?;
    Ok(task)
}

/// 批量更新 task 顺序（事务保证原子性）。
pub async fn reorder_tasks(db: &mut toasty::Db, pairs: Vec<(uuid::Uuid, i32)>) -> Result<()> {
    for (_, order) in &pairs {
        if *order < 1 {
            bail!("order 必须大于等于 1");
        }
    }
    let mut tx = db.transaction().await?;
    for (id, order) in pairs {
        let mut task = Task::get_by_id(&mut tx, &id).await?;
        task.update().order(order).exec(&mut tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn delete_task(db: &mut toasty::Db, id: uuid::Uuid) -> Result<()> {
    let task = Task::get_by_id(db, &id).await?;
    task.delete().exec(db).await?;
    Ok(())
}

/// 标记任务状态（执行器使用）。
pub async fn set_task_status(
    db: &mut toasty::Db,
    id: uuid::Uuid,
    status: TaskStatus,
) -> Result<()> {
    let mut task = Task::get_by_id(db, &id).await?;
    task.update().status(status).updated_at(now_ms()).exec(db).await?;
    Ok(())
}

/// 更新进度与可选错误信息（执行器使用）。
pub async fn update_task_progress(
    db: &mut toasty::Db,
    id: uuid::Uuid,
    progress_current: i32,
    progress_total: i32,
) -> Result<()> {
    let mut task = Task::get_by_id(db, &id).await?;
    task.update()
        .progress_current(progress_current)
        .progress_total(progress_total)
        .updated_at(now_ms())
        .exec(db)
        .await?;
    Ok(())
}

/// 置失败并记录错误信息。
pub async fn fail_task(db: &mut toasty::Db, id: uuid::Uuid, error: String) -> Result<()> {
    let mut task = Task::get_by_id(db, &id).await?;
    task.update()
        .status(TaskStatus::Failed)
        .error(Some(error))
        .updated_at(now_ms())
        .exec(db)
        .await?;
    Ok(())
}

/// 重置任务为待运行（重跑：清 error/进度，置 Pending）。
pub async fn reset_for_run(db: &mut toasty::Db, id: uuid::Uuid) -> Result<()> {
    let mut task = Task::get_by_id(db, &id).await?;
    task.update()
        .status(TaskStatus::Pending)
        .error(None)
        .progress_current(0)
        .progress_total(0)
        .updated_at(now_ms())
        .exec(db)
        .await?;
    Ok(())
}
