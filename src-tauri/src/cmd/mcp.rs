use super::{CmdResult, StringifyErr};
use crate::kernel::context::AppContext;
use crate::utils::async_handler::AsyncHandler;
use logging::{logging, Type};
use mcp::{CallToolResult, PromptInfo, ResourceInfo, ServerInfo, ServerStatus, ToolInfo};
use serde::Serialize;
use tauri::ipc::Channel;
use tokio::sync::broadcast;
use tokio_stream::StreamExt;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub progress: f64,
    pub total: Option<f64>,
    pub message: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogPayload {
    pub level: String,
    pub logger: Option<String>,
    pub data: serde_json::Value,
}

#[tauri::command]
pub async fn mcp_list_tools() -> CmdResult<Vec<ToolInfo>> {
    logging!(info, Type::Cmd, "mcp_list_tools called");
    let manager = AppContext::mcp_manager();
    Ok(manager.list_tools().await)
}

#[tauri::command]
pub async fn mcp_call_tool(
    server_name: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
) -> CmdResult<CallToolResult> {
    logging!(
        info,
        Type::Cmd,
        "mcp_call_tool called: server={}, tool={}",
        server_name,
        tool_name
    );
    let manager = AppContext::mcp_manager();
    manager
        .call_tool(&server_name, &tool_name, arguments)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn mcp_server_status(server_name: String) -> CmdResult<ServerStatus> {
    logging!(info, Type::Cmd, "mcp_server_status called: server={}", server_name);
    let manager = AppContext::mcp_manager();
    manager
        .server_status(&server_name)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn mcp_server_info(server_name: String) -> CmdResult<Option<ServerInfo>> {
    logging!(info, Type::Cmd, "mcp_server_info called: server={}", server_name);
    let manager = AppContext::mcp_manager();
    manager
        .server_info(&server_name)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn mcp_list_prompts() -> CmdResult<Vec<PromptInfo>> {
    logging!(info, Type::Cmd, "mcp_list_prompts called");
    let manager = AppContext::mcp_manager();
    Ok(manager.list_prompts().await)
}

#[tauri::command]
pub async fn mcp_list_resources() -> CmdResult<Vec<ResourceInfo>> {
    logging!(info, Type::Cmd, "mcp_list_resources called");
    let manager = AppContext::mcp_manager();
    Ok(manager.list_resources().await)
}

#[tauri::command]
pub async fn mcp_call_tool_with_progress(
    server_name: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
    on_progress: Channel<ProgressPayload>,
    on_log: Channel<LogPayload>,
) -> CmdResult<CallToolResult> {
    logging!(
        info,
        Type::Cmd,
        "mcp_call_tool_with_progress called: server={}, tool={}",
        server_name,
        tool_name
    );
    let manager = AppContext::mcp_manager();
    let (result, mut progress_subscriber, mut log_rx) = manager
        .call_tool_with_progress(&server_name, &tool_name, arguments)
        .await
        .stringify_err()?;

    // Spawn task to forward progress notifications to Channel
    AsyncHandler::spawn(move || async move {
        while let Some(notification) = progress_subscriber.next().await {
            let payload = ProgressPayload {
                progress: notification.progress,
                total: notification.total,
                message: notification.message,
            };
            if on_progress.send(payload).is_err() {
                break;
            }
        }
    });

    // Spawn task to forward log events to Channel
    AsyncHandler::spawn(move || async move {
        loop {
            match log_rx.recv().await {
                Ok(event) => {
                    let payload = LogPayload {
                        level: serde_json::to_string(&event.level)
                            .unwrap_or_default()
                            .trim_matches('"')
                            .to_string(),
                        logger: event.logger,
                        data: event.data,
                    };
                    if on_log.send(payload).is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    logging!(warn, Type::Cmd, "MCP log receiver lagged, dropped {} messages", n);
                    continue;
                }
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    Ok(result)
}
