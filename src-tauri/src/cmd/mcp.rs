use super::{CmdResult, StringifyErr};
use crate::kernel::context::AppContext;
use logging::{logging, Type};
use mcp::{PromptInfo, ResourceInfo, ServerInfo, ServerStatus, ToolInfo};

#[tauri::command]
pub async fn mcp_list_tools() -> CmdResult<Vec<ToolInfo>> {
    logging!(info, Type::Cmd, "mcp_list_tools called");
    let manager = AppContext::mcp_manager();
    Ok(manager.list_tools().await)
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
