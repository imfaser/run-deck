use logging::{logging, Type};

#[tauri::command]
pub fn greet(name: &str) -> String {
    logging!(info, Type::Cmd, "greet called with name: {}", name);
    format!("Hello, {}! You've been greeted from Rust!", name)
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
