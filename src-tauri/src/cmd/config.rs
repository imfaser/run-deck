use super::CmdResult;
use crate::config::Config;
use logging::{logging, Type};

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
    config.edit_draft(|draft| *draft = new_config);
    Ok(())
}
