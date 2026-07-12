use super::{CmdResult, StringifyErr};
use crate::kernel::context::AppContext;
use logging::{logging, Type};
use mcp::{CallToolResult, ServerStatus, ToolInfo};

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
