use super::CmdResult;
use crate::kernel::context::AppContext;
use logging::{logging, Type};
use sha2::{Digest as _, Sha256};

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
pub fn mcp_store_content(path: String) -> CmdResult<String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file {path}: {e}"))?;

    let hash = {
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        hex::encode(hasher.finalize())
    };

    let mime = mime_guess::from_path(&path).first_or_octet_stream().to_string();
    AppContext::mcp_content_store().insert(hash.clone(), (mime, bytes));

    logging!(debug, Type::Cmd, "Stored content for {path} as mcp://localhost/{hash}");
    Ok(format!("mcp://localhost/{hash}"))
}
