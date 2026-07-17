use tauri::Builder;

pub fn setup_plugins(builder: Builder<tauri::Wry>) -> Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
}

pub fn setup_protocols(builder: Builder<tauri::Wry>) -> Builder<tauri::Wry> {
    builder.register_uri_scheme_protocol("mcp", crate::utils::mcp_content::mcp_protocol_handler)
}

pub fn generate_handlers() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static
{
    tauri::generate_handler![
        crate::cmd::general::greet,
        crate::cmd::general::log_message,
        crate::cmd::general::mcp_store_content,
        crate::cmd::mcp::mcp_list_tools,
        crate::cmd::mcp::mcp_call_tool,
        crate::cmd::mcp::mcp_call_tool_with_progress,
        crate::cmd::mcp::mcp_server_status,
        crate::cmd::mcp::mcp_server_info,
        crate::cmd::mcp::mcp_list_prompts,
        crate::cmd::mcp::mcp_list_resources,
        crate::cmd::config::get_config,
        crate::cmd::config::update_config
    ]
}
