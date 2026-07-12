pub mod utils;
pub mod cmd;
pub mod config;
pub mod kernel;
pub mod setup;

use logging::{logging, Type};
use std::sync::OnceLock;
use tauri::AppHandle;

use mcp::McpManager;
use utils::async_handler::AsyncHandler;

pub static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
pub static MCP_MANAGER: OnceLock<McpManager> = OnceLock::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    let builder = setup::setup_plugins(builder);
    builder
        .setup(|app| {
            APP_HANDLE
                .set(app.handle().clone())
                .expect("app handle failed to set");

            // Initialize AppContext singleton
            kernel::context::AppContext::global();

            // Initialize logging with log directory
            let log_dir = config::dirs::app_logs_dir().ok();
            logging::setup_log(log_dir.as_deref());

            utils::log_app_info();
            logging!(info, Type::Setup, "应用启动完成");

            // Initialize Config
            let config = config::Config::global();
            let mcp_config = config.data_arc().mcp_servers.clone();
            
            // Initialize McpManager
            if MCP_MANAGER.set(McpManager::new(mcp_config)).is_err() {
                logging!(error, Type::Setup, "Failed to init McpManager");
            }

            // Async start MCP servers
            let server_names: Vec<String> = config.data_arc().mcp_servers.keys().cloned().collect();
            if !server_names.is_empty() {
                logging!(info, Type::Setup, "Starting {} MCP server(s)...", server_names.len());
                AsyncHandler::spawn(move || async move {
                    let manager = MCP_MANAGER.get().unwrap();
                    for name in &server_names {
                        if let Err(e) = manager.start_server(name).await {
                            logging!(warn, Type::Setup, "Failed to start MCP server '{name}': {e}");
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(setup::generate_handlers())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
