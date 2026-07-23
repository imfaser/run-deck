use super::CmdResult;
use crate::config::Config;
use logging::{logging, update_log_level, Type};

#[tauri::command]
pub fn get_config() -> CmdResult<Config> {
    logging!(info, Type::Cmd, "get_config called");
    let config = Config::global();
    Ok((*config.data_arc()).clone())
}

#[tauri::command]
pub fn update_config(new_config: Config) -> CmdResult {
    logging!(info, Type::Cmd, "update_config called");
    let config = Config::global();
    let old_level = config.data_arc().log_level.clone();
    config.edit_draft(|draft| *draft = new_config);
    let new_level = config.data_arc().log_level.clone();
    if old_level != new_level {
        if let Err(e) = update_log_level(&new_level) {
            logging!(warn, Type::Config, "Failed to update log level: {e}");
        }
    }
    Ok(())
}
