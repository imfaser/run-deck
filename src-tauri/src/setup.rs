use tauri::Builder;

pub fn setup_plugins(builder: Builder<tauri::Wry>) -> Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
}

pub fn generate_handlers() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static
{
    tauri::generate_handler![
        crate::cmd::greet,
        crate::cmd::log_message,
        crate::cmd::mcp_list_tools,
        crate::cmd::mcp_call_tool,
        crate::cmd::mcp_server_status
    ]
}
