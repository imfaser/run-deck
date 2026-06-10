pub mod utils;
pub mod cmd;
pub mod config;
pub mod kernel;
pub mod setup;

use logging::{logging, Type};
use once_cell::sync::OnceCell;
use tauri::AppHandle;

pub static APP_HANDLE: OnceCell<AppHandle> = OnceCell::new();

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
            Ok(())
        })
        .invoke_handler(setup::generate_handlers())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
