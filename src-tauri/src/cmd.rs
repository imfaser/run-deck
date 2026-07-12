use crate::kernel::context::AppContext;
use crate::MCP_MANAGER;
use logging::{logging, Type};
use mcp::{CallToolResult, ServerStatus, ToolInfo};

#[tauri::command]
pub fn greet() {
    logging!(info, Type::Cmd, "greet called, sending ping");
    AppContext::send_ping();
}

#[tauri::command]
pub fn log_message(level: String, message: String) {
    match level.as_str() {
        "error" => logging!(error, Type::Frontend, "{}", message),
        "warn" => logging!(warn, Type::Frontend, "{}", message),
        "debug" => logging!(debug, Type::Frontend, "{}", message),
        "trace" => logging!(trace, Type::Frontend, "{}", message),
        _ => logging!(info, Type::Frontend, "{}", message),
    }
}

#[tauri::command]
pub async fn mcp_list_tools() -> Result<Vec<ToolInfo>, String> {
    logging!(info, Type::Cmd, "mcp_list_tools called");
    let manager = MCP_MANAGER.get().ok_or("MCP manager not initialized")?;
    Ok(manager.list_tools().await)
}

#[tauri::command]
pub async fn mcp_call_tool(
    server_name: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
) -> Result<CallToolResult, String> {
    logging!(
        info,
        Type::Cmd,
        "mcp_call_tool called: server={}, tool={}",
        server_name,
        tool_name
    );
    let manager = MCP_MANAGER.get().ok_or("MCP manager not initialized")?;
    manager
        .call_tool(&server_name, &tool_name, arguments)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mcp_server_status(server_name: String) -> Result<ServerStatus, String> {
    logging!(info, Type::Cmd, "mcp_server_status called: server={}", server_name);
    let manager = MCP_MANAGER.get().ok_or("MCP manager not initialized")?;
    manager
        .server_status(&server_name)
        .await
        .map_err(|e| e.to_string())
}
