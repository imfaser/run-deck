use crate::kernel::context::AppContext;
use logging::{logging, Type};

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
