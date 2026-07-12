use std::sync::Arc;

use super::{CmdResult, StringifyErr};
use crate::config::Config;
use logging::{logging, Type};

#[tauri::command]
pub fn get_config() -> CmdResult<Config> {
    logging!(info, Type::Cmd, "get_config called");
    let path = crate::config::dirs::config_file().stringify_err()?;
    Config::load(&path).stringify_err()
}

#[tauri::command]
pub fn get_draft_config() -> CmdResult<Option<Config>> {
    logging!(info, Type::Cmd, "get_draft_config called");
    let config = Config::global();
    let committed = config.data_arc();
    let latest = config.latest_arc();
    if Arc::ptr_eq(&latest, &committed) {
        Ok(None)
    } else {
        Ok(Some((*latest).clone()))
    }
}

#[tauri::command]
pub fn config_draft_exist() -> CmdResult<bool> {
    logging!(info, Type::Cmd, "config_draft_exist called");
    let config = Config::global();
    let committed = config.data_arc();
    let latest = config.latest_arc();
    Ok(!Arc::ptr_eq(&latest, &committed))
}

#[tauri::command]
pub fn config_has_changes() -> CmdResult<bool> {
    logging!(info, Type::Cmd, "config_has_changes called");
    let config = Config::global();
    let committed = config.data_arc();
    let latest = config.latest_arc();
    Ok(!Arc::ptr_eq(&latest, &committed) && *committed != *latest)
}

#[tauri::command]
pub fn update_config(new_config: Config) -> CmdResult {
    logging!(info, Type::Cmd, "update_config called");
    let config = Config::global();
    config.edit_draft(|draft| *draft = new_config);
    Ok(())
}

#[tauri::command]
pub fn save_config() -> CmdResult {
    logging!(info, Type::Cmd, "save_config called");
    let config = Config::global();

    let committed = config.data_arc();
    let latest = config.latest_arc();
    if Arc::ptr_eq(&latest, &committed) {
        return Err("没有待保存的配置修改".to_string());
    }

    config.apply();

    let data = config.data_arc();
    let path = crate::config::dirs::config_file().stringify_err()?;
    let content = serde_json::to_string_pretty(&*data).stringify_err()?;
    std::fs::write(&path, content).stringify_err()?;

    logging!(info, Type::Cmd, "Config saved to disk");
    Ok(())
}
