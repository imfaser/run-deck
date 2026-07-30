use super::CmdResult;
use crate::{cmd::StringifyErr, kernel::context::AppContext};
use logging::{logging, Type};

#[tauri::command]
pub fn greet() -> CmdResult {
    logging!(info, Type::Cmd, "greet called, sending ping");
    AppContext::send_ping();
    Ok(())
}

#[tauri::command]
pub fn log_message(level: String, message: String) -> CmdResult {
    match level.as_str() {
        "error" => logging!(error, Type::Frontend, "{}", message),
        "warn" => logging!(warn, Type::Frontend, "{}", message),
        "debug" => logging!(debug, Type::Frontend, "{}", message),
        "trace" => logging!(trace, Type::Frontend, "{}", message),
        _ => logging!(info, Type::Frontend, "{}", message),
    }
    Ok(())
}

#[tauri::command]
pub fn cache_store_path(path: String) -> CmdResult<String> {
    let cache = AppContext::content_cache();
    let hash = cache.store_path(&path).stringify_err()?;
    Ok(hash)
}
