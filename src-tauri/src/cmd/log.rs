use super::{CmdResult, StringifyErr};
use crate::config;
use logging::{
    cleanup_old_logs, logging, parse_log_line, set_emitter_enabled, update_log_level, LogEntry,
    Type,
};
use std::fs;

#[tauri::command]
pub fn set_log_level(level: String) -> CmdResult {
    logging!(info, Type::Config, "Setting log level to: {level}");
    update_log_level(&level).stringify_err()
}

/// 日志目录绝对路径（供前端「打开日志目录」）。
#[tauri::command]
pub fn get_log_dir() -> CmdResult<String> {
    let dir = config::dirs::app_logs_dir().stringify_err()?;
    Ok(dir.to_string_lossy().into_owned())
}

/// 立即删除超过保留天数的日志文件，返回删除数量。
#[tauri::command]
pub fn cleanup_logs() -> CmdResult<u32> {
    let dir = config::dirs::app_logs_dir().stringify_err()?;
    let retention_days = config::Config::global().data_arc().log_retention_days;

    let before: Vec<_> = fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "log"))
        .collect();
    let before_len = before.len() as u32;

    cleanup_old_logs(&dir, retention_days);

    let after: Vec<_> = fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "log"))
        .collect();
    let deleted = before_len.saturating_sub(after.len() as u32);
    logging!(info, Type::File, "cleanup_logs: deleted {deleted} file(s)");
    Ok(deleted)
}

/// 读取最新日志文件尾部 n 行并解析为日志条目（时间序）。
/// 日志文件名带启动时间戳（如 `20260802-132436_407_latest.log`），需动态查找。
#[tauri::command]
pub fn get_latest_logs(n: usize) -> CmdResult<Vec<LogEntry>> {
    let dir = config::dirs::app_logs_dir().stringify_err()?;
    let path = find_latest_log_file(&dir);
    if path.is_none() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path.unwrap()).stringify_err()?;
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(n);
    let entries: Vec<LogEntry> = lines[start..]
        .iter()
        .filter_map(|line| parse_log_line(line))
        .collect();
    Ok(entries)
}

/// 在日志目录中找修改时间最新的 `*.log` 文件。
fn find_latest_log_file(dir: &std::path::Path) -> Option<std::path::PathBuf> {
    fs::read_dir(dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|ext| ext == "log"))
        .max_by_key(|p| fs::metadata(p).and_then(|m| m.modified()).ok())
}

/// 开启/关闭日志事件流（/logs 页挂载/卸载时调用）。
/// 先落地开关再写日志：开启瞬间 emit 仍是关闭的，本命令的日志行只会写入文件
/// 不会被 echo 回前端，避免「实时 echo 早于历史」的错序与重复。
#[tauri::command]
pub fn set_log_emit(enabled: bool) -> CmdResult {
    if !enabled {
        set_emitter_enabled(false);
    }
    logging!(info, Type::Window, "set_log_emit: enabled={enabled}");
    if enabled {
        set_emitter_enabled(true);
    }
    Ok(())
}
