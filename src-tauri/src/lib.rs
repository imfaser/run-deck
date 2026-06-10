pub mod cmd;
pub mod setup;
pub mod config;
use once_cell::sync::OnceCell;
use tauri::AppHandle;

pub static APP_HANDLE: OnceCell<AppHandle> = OnceCell::new();
use logging::{logging, Type};
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::setup_log();
    logging!(info, Type::Setup, "应用启动中");
    let builder = tauri::Builder::default();
    let builder = setup::setup_plugins(builder);
    builder
        .setup(|app| {
            APP_HANDLE
                .set(app.handle().clone())
                .expect("app handle failed to set");
            logging!(info, Type::Setup, "应用启动完成");
            Ok(())
        })
        .invoke_handler(setup::generate_handlers())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
