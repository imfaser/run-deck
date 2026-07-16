use super::{CmdResult, StringifyErr};
use crate::config::dirs;
use crate::kernel::context::AppContext;
use crate::utils::async_handler::AsyncHandler;
use base64::Engine as _;
use logging::{logging, Type};
use mcp::{AudioContent, CallToolResult, ContentBlock, ImageContent, PromptInfo, ResourceInfo, ServerInfo, ServerStatus, ToolInfo};
use serde::Serialize;
use sha2::{Digest as _, Sha256};
use tauri::ipc::Channel;
use tokio::sync::broadcast;
use tokio_stream::StreamExt;

const BASE64_PREFIX: &str = "base64://";

fn resolve_base64_args(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let transformed: serde_json::Map<String, serde_json::Value> = map
                .into_iter()
                .map(|(k, v)| (k, resolve_base64_args(v)))
                .collect();
            serde_json::Value::Object(transformed)
        }
        serde_json::Value::String(s) if s.starts_with(BASE64_PREFIX) => {
            let file_path = &s[BASE64_PREFIX.len()..];
            match std::fs::read(file_path) {
                Ok(bytes) => {
                    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
                    logging!(
                        debug,
                        Type::Cmd,
                        "Resolved base64://{} -> {} bytes encoded",
                        file_path,
                        bytes.len()
                    );
                    serde_json::Value::String(encoded)
                }
                Err(e) => {
                    logging!(
                        warn,
                        Type::Cmd,
                        "Failed to read file for base64://{}: {e}",
                        file_path
                    );
                    serde_json::Value::String(s)
                }
            }
        }
        other => other,
    }
}

fn mime_type_to_ext(mime_type: &str) -> &'static str {
    match mime_type {
        "image/png" => ".png",
        "image/jpeg" => ".jpg",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        "image/svg+xml" => ".svg",
        "image/bmp" => ".bmp",
        "audio/wav" => ".wav",
        "audio/mpeg" => ".mp3",
        "audio/ogg" => ".ogg",
        "audio/flac" => ".flac",
        "audio/aac" => ".aac",
        "audio/webm" => ".webm",
        _ => ".bin",
    }
}

fn materialize_content(mut result: CallToolResult) -> serde_json::Value {
    let cache_dir = match dirs::app_mcp_cache_dir() {
        Ok(dir) => dir,
        Err(e) => {
            logging!(warn, Type::Cmd, "Failed to get mcp cache dir: {e}");
            return serde_json::to_value(result).unwrap_or_default();
        }
    };

    if let Err(e) = std::fs::create_dir_all(&cache_dir) {
        logging!(warn, Type::Cmd, "Failed to create mcp cache dir: {e}");
        return serde_json::to_value(result).unwrap_or_default();
    }

    let content = std::mem::take(&mut result.content);
    let mut modified = false;

    let processed: Vec<ContentBlock> = content
        .into_iter()
        .map(|block| match block {
            ContentBlock::Image(img) => {
                match save_base64_to_cache(&img.data, &img.mime_type, &cache_dir) {
                    Ok(path) => {
                        modified = true;
                        ContentBlock::Image(ImageContent::new(path, img.mime_type))
                    }
                    Err(_) => ContentBlock::Image(img),
                }
            }
            ContentBlock::Audio(audio) => {
                match save_base64_to_cache(&audio.data, &audio.mime_type, &cache_dir) {
                    Ok(path) => {
                        modified = true;
                        ContentBlock::Audio(AudioContent::new(path, audio.mime_type))
                    }
                    Err(_) => ContentBlock::Audio(audio),
                }
            }
            other => other,
        })
        .collect();

    if modified {
        logging!(debug, Type::Cmd, "Materialized base64 content to cache files");
    }

    // Serialize shell result to get meta/is_error/structured_content, then patch content
    let mut value = serde_json::to_value(result).unwrap_or_default();
    if let Ok(content_json) = serde_json::to_value(&processed) {
        value["content"] = content_json;
    }
    value
}

fn save_base64_to_cache(
    data: &str,
    mime_type: &str,
    cache_dir: &std::path::Path,
) -> Result<String, ()> {
    let ext = mime_type_to_ext(mime_type);
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| {
            logging!(warn, Type::Cmd, "Failed to decode base64: {e}");
        })?;

    let hash = {
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        hex::encode(hasher.finalize())
    };
    let filename = format!("{}{}", &hash[..16], ext);
    let file_path = cache_dir.join(&filename);

    std::fs::write(&file_path, &decoded).map_err(|e| {
        logging!(
            warn,
            Type::Cmd,
            "Failed to write mcp cache file {:?}: {e}",
            file_path
        );
    })?;

    Ok(file_path.to_string_lossy().into_owned())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub progress: f64,
    pub total: Option<f64>,
    pub message: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogPayload {
    pub level: String,
    pub logger: Option<String>,
    pub data: serde_json::Value,
}

#[tauri::command]
pub async fn mcp_list_tools() -> CmdResult<Vec<ToolInfo>> {
    logging!(info, Type::Cmd, "mcp_list_tools called");
    let manager = AppContext::mcp_manager();
    Ok(manager.list_tools().await)
}

#[tauri::command]
pub async fn mcp_call_tool(
    server_name: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
) -> CmdResult<serde_json::Value> {
    logging!(
        info,
        Type::Cmd,
        "mcp_call_tool called: server={}, tool={}",
        server_name,
        tool_name
    );
    let manager = AppContext::mcp_manager();
    let resolved_args = arguments.map(resolve_base64_args);
    let result: CallToolResult = manager
        .call_tool(&server_name, &tool_name, resolved_args)
        .await
        .stringify_err()?;

    Ok(materialize_content(result))
}

#[tauri::command]
pub async fn mcp_server_status(server_name: String) -> CmdResult<ServerStatus> {
    logging!(info, Type::Cmd, "mcp_server_status called: server={}", server_name);
    let manager = AppContext::mcp_manager();
    manager
        .server_status(&server_name)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn mcp_server_info(server_name: String) -> CmdResult<Option<ServerInfo>> {
    logging!(info, Type::Cmd, "mcp_server_info called: server={}", server_name);
    let manager = AppContext::mcp_manager();
    manager
        .server_info(&server_name)
        .await
        .stringify_err()
}

#[tauri::command]
pub async fn mcp_list_prompts() -> CmdResult<Vec<PromptInfo>> {
    logging!(info, Type::Cmd, "mcp_list_prompts called");
    let manager = AppContext::mcp_manager();
    Ok(manager.list_prompts().await)
}

#[tauri::command]
pub async fn mcp_list_resources() -> CmdResult<Vec<ResourceInfo>> {
    logging!(info, Type::Cmd, "mcp_list_resources called");
    let manager = AppContext::mcp_manager();
    Ok(manager.list_resources().await)
}

#[tauri::command]
pub async fn mcp_call_tool_with_progress(
    server_name: String,
    tool_name: String,
    arguments: Option<serde_json::Value>,
    on_progress: Channel<ProgressPayload>,
    on_log: Channel<LogPayload>,
) -> CmdResult<serde_json::Value> {
    logging!(
        info,
        Type::Cmd,
        "mcp_call_tool_with_progress called: server={}, tool={}",
        server_name,
        tool_name
    );
    let manager = AppContext::mcp_manager();
    let resolved_args = arguments.map(resolve_base64_args);
    let (result, mut progress_subscriber, mut log_rx) = manager
        .call_tool_with_progress(&server_name, &tool_name, resolved_args)
        .await
        .stringify_err()?;

    // Spawn task to forward progress notifications to Channel
    AsyncHandler::spawn(move || async move {
        while let Some(notification) = progress_subscriber.next().await {
            let payload = ProgressPayload {
                progress: notification.progress,
                total: notification.total,
                message: notification.message,
            };
            if on_progress.send(payload).is_err() {
                break;
            }
        }
    });

    // Spawn task to forward log events to Channel
    AsyncHandler::spawn(move || async move {
        loop {
            match log_rx.recv().await {
                Ok(event) => {
                    let payload = LogPayload {
                        level: serde_json::to_string(&event.level)
                            .unwrap_or_default()
                            .trim_matches('"')
                            .to_string(),
                        logger: event.logger,
                        data: event.data,
                    };
                    if on_log.send(payload).is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    logging!(warn, Type::Cmd, "MCP log receiver lagged, dropped {} messages", n);
                    continue;
                }
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    Ok(materialize_content(result))
}
