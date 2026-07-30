use super::{CmdResult, StringifyErr};
use logging::{logging, update_log_level, Type};

#[tauri::command]
pub fn set_log_level(level: String) -> CmdResult {
    logging!(info, Type::Config, "Setting log level to: {level}");
    update_log_level(&level).stringify_err()
}
