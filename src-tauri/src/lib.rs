pub mod utils;
pub mod cmd;
pub mod config;
pub mod kernel;
pub mod setup;

use logging::{logging, Type};
use std::sync::OnceLock;
use tauri::AppHandle;

use kernel::context::AppContext;
use mcp::McpManager;
use mcp::shell::ShellType;
use utils::async_handler::AsyncHandler;

pub(crate) static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
pub(crate) static MCP_MANAGER: OnceLock<McpManager> = OnceLock::new();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    let builder = setup::setup_plugins(builder);
    let builder = setup::setup_protocols(builder);
    let builder = builder
        .setup(|app| {
            APP_HANDLE
                .set(app.handle().clone())
                .expect("app handle failed to set");

            // Initialize AppContext singleton
            AppContext::global();

            // Initialize Config
            let config = config::Config::global();

            // Initialize logging with log directory
            let log_dir = config::dirs::app_logs_dir().ok();
            let log_level = config.data_arc().log_level.clone();
            logging::setup_log(log_dir.as_deref(), &log_level);

            utils::log_app_info();
            logging!(info, Type::Setup, "应用启动完成");

            let mcp_config = config.data_arc().mcp.clone();
            let shell = match config.data_arc().shell.as_str() {
                "powershell" | "pwsh" => ShellType::PowerShell,
                "cmd" => ShellType::Cmd,
                "bash" => ShellType::Bash,
                _ => ShellType::Auto,
            };

            // Initialize McpManager
            if MCP_MANAGER.set(McpManager::new(mcp_config, shell)).is_err() {
                logging!(error, Type::Setup, "Failed to init McpManager");
            }

            // Async start MCP servers
            let server_names: Vec<String> = config.data_arc().mcp.iter()
                .filter(|(_, cfg)| cfg.is_enabled())
                .map(|(name, _)| name.clone())
                .collect();
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
        .invoke_handler(setup::generate_handlers());

    let app = builder
        .build(tauri::generate_context!())
        .unwrap_or_else(|e| {
            logging!(error, Type::Setup, "Failed to build Tauri application: {e}");
            std::process::exit(1);
        });

    app.run(|app_handle, e| match e {
        tauri::RunEvent::ExitRequested { api: _, .. } => {
            // Prevent re-entry
            if AppContext::global().is_exiting() {
                return;
            }
            AppContext::global().set_is_exiting();

            logging!(info, Type::System, "Exit requested, saving config and cleaning up");

            // Save config
            if let Err(e) = config::Config::save_global() {
                logging!(warn, Type::System, "Failed to save config on exit: {e}");
            }

            // Stop MCP servers (async in sync context)
            if let Some(manager) = MCP_MANAGER.get() {
                AsyncHandler::block_on(manager.stop_all());
            }

            app_handle.exit(0);
        }
        tauri::RunEvent::Exit => {
            // Final save attempt (e.g., system shutdown)
            if !AppContext::global().is_exiting() {
                let _ = config::Config::save_global();
            }
            logging!(info, Type::System, "Application exited");
        }
        _ => {}
    });
}
