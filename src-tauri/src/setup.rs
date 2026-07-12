use tauri::Builder;

pub fn setup_plugins(builder: Builder<tauri::Wry>) -> Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
}

pub fn generate_handlers() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static
{
    tauri::generate_handler![
        crate::cmd::general::greet,
        crate::cmd::general::log_message,
        crate::cmd::mcp::mcp_list_tools,
        crate::cmd::mcp::mcp_call_tool,
        crate::cmd::mcp::mcp_server_status,
        crate::cmd::config::get_config,
        crate::cmd::config::get_draft_config,
        crate::cmd::config::config_draft_exist,
        crate::cmd::config::config_has_changes,
        crate::cmd::config::update_config,
        crate::cmd::config::save_config
    ]
}
