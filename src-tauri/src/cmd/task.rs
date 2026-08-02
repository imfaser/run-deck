use super::{CmdResult, StringifyErr};
use crate::kernel::context::AppContext;
use crate::kernel::notification::FrontendEvent;
use crate::task::TaskRunner;
use db::models::task::{Task, TaskStatus};
use db::ops::task_ops::{self, TaskCreateInput, TaskPatch};
use logging::{logging, Type};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskOrderInput {
    pub id: uuid::Uuid,
    pub order: i32,
}

#[tauri::command]
pub async fn task_create(input: TaskCreateInput) -> CmdResult<Task> {
    logging!(info, Type::Cmd, "task_create: name={}", input.name);
    let mut db = AppContext::db().clone();
    let task = task_ops::create_task(&mut db, input).await.stringify_err()?;
    AppContext::send_event(FrontendEvent::TaskChanged { task_id: task.id });
    Ok(task)
}

#[tauri::command]
pub async fn task_list() -> CmdResult<Vec<Task>> {
    logging!(info, Type::Cmd, "task_list");
    let mut db = AppContext::db().clone();
    task_ops::list_tasks(&mut db).await.stringify_err()
}

#[tauri::command]
pub async fn task_update(id: uuid::Uuid, patch: TaskPatch) -> CmdResult<Task> {
    logging!(info, Type::Cmd, "task_update: id={id}");
    let mut db = AppContext::db().clone();
    let task = task_ops::update_task(&mut db, id, patch).await.stringify_err()?;
    AppContext::send_event(FrontendEvent::TaskChanged { task_id: task.id });
    Ok(task)
}

#[tauri::command]
pub async fn task_reorder(inputs: Vec<TaskOrderInput>) -> CmdResult {
    logging!(info, Type::Cmd, "task_reorder: {} tasks", inputs.len());
    let mut db = AppContext::db().clone();
    let pairs: Vec<(uuid::Uuid, i32)> = inputs.into_iter().map(|i| (i.id, i.order)).collect();
    task_ops::reorder_tasks(&mut db, pairs).await.stringify_err()?;
    AppContext::send_event(FrontendEvent::TaskChanged { task_id: uuid::Uuid::nil() });
    Ok(())
}

#[tauri::command]
pub async fn task_delete(id: uuid::Uuid) -> CmdResult {
    logging!(info, Type::Cmd, "task_delete: id={id}");
    let mut db = AppContext::db().clone();
    let task = task_ops::get_task_by_id(&mut db, id)
        .await
        .stringify_err()?
        .ok_or_else(|| "task not found".to_string())?;
    if matches!(task.status, TaskStatus::Running) {
        TaskRunner::global().cancel(id);
    }
    task_ops::delete_task(&mut db, id).await.stringify_err()?;
    AppContext::send_event(FrontendEvent::TaskChanged { task_id: id });
    Ok(())
}

#[tauri::command]
pub async fn task_run(id: uuid::Uuid) -> CmdResult {
    logging!(info, Type::Cmd, "task_run: id={id}");
    let mut db = AppContext::db().clone();
    let task = task_ops::get_task_by_id(&mut db, id)
        .await
        .stringify_err()?
        .ok_or_else(|| "task not found".to_string())?;
    if matches!(task.status, TaskStatus::Running) {
        return Err("task already running".into());
    }
    task_ops::reset_for_run(&mut db, id).await.stringify_err()?;
    TaskRunner::global().enqueue(id);
    AppContext::send_event(FrontendEvent::TaskChanged { task_id: id });
    Ok(())
}

#[tauri::command]
pub async fn task_cancel(id: uuid::Uuid) -> CmdResult {
    logging!(info, Type::Cmd, "task_cancel: id={id}");
    let mut db = AppContext::db().clone();
    let task = task_ops::get_task_by_id(&mut db, id)
        .await
        .stringify_err()?
        .ok_or_else(|| "task not found".to_string())?;
    if matches!(task.status, TaskStatus::Running) {
        TaskRunner::global().cancel(id);
        AppContext::send_event(FrontendEvent::TaskChanged { task_id: id });
    }
    Ok(())
}
