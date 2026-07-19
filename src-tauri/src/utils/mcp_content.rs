use crate::singleton;
use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use http::header::{ACCESS_CONTROL_ALLOW_ORIGIN, CONTENT_TYPE};
use http::{HeaderValue, Request, Response, StatusCode};
use logging::{logging, Type};
use mcp::{AudioContent, CallToolResult, ContentBlock, ImageContent};
use moka::sync::Cache;
use serde_json::{Map, Value};
use sha2::{Digest as _, Sha256};

const BASE64_PREFIX: &str = "base64://";
#[cfg(windows)]
pub const MCP_PREFIX: &str = "http://mcp.localhost/";
#[cfg(not(windows))]
pub const MCP_PREFIX: &str = "mcp://localhost/";

type CacheEntry = (String, Vec<u8>);

/// MCP 内容缓存：key = SHA256 hash, value = (mime_type, bytes)
/// 1GB LRU 上限，无 TTL，按 bytes 权重淘汰
pub struct McpContentStore {
    cache: Cache<String, CacheEntry>,
}

singleton!(McpContentStore, MCP_CONTENT_STORE);

impl McpContentStore {
    pub fn new() -> Self {
        Self {
            cache: Cache::builder()
                .max_capacity(1024 * 1024 * 1024)
                .weigher(|_key, value: &CacheEntry| -> u32 {
                    (value.1.len() as u32).saturating_add(64)
                })
                .build(),
        }
    }

    pub fn get(&self, hash: &str) -> Option<CacheEntry> {
        self.cache.get(hash)
    }

    pub fn insert(&self, hash: String, entry: CacheEntry) {
        self.cache.insert(hash, entry);
    }

    fn resolve_mcp_hash(&self, hash: &str, original: &str) -> Value {
        if let Some((_mime, bytes)) = self.get(hash) {
            let encoded = STANDARD.encode(&bytes);
            logging!(
                debug,
                Type::Cmd,
                "Resolved mcp content {} -> {} bytes encoded",
                hash,
                bytes.len()
            );
            Value::String(encoded)
        } else {
            logging!(warn, Type::Cmd, "Content not found for mcp://{hash}");
            Value::String(original.to_string())
        }
    }

    pub fn resolve_args(&self, value: Value) -> Value {
        match value {
            Value::Object(map) => {
                let transformed: Map<String, Value> = map
                    .into_iter()
                    .map(|(k, v)| (k, self.resolve_args(v)))
                    .collect();
                Value::Object(transformed)
            }
            Value::String(s) if s.starts_with(BASE64_PREFIX) => {
                let file_path = &s[BASE64_PREFIX.len()..];
                match std::fs::read(file_path) {
                    Ok(bytes) => {
                        let encoded = STANDARD.encode(&bytes);
                        logging!(
                            debug,
                            Type::Cmd,
                            "Resolved base64://{} -> {} bytes encoded",
                            file_path,
                            bytes.len()
                        );
                        Value::String(encoded)
                    }
                    Err(e) => {
                        logging!(
                            warn,
                            Type::Cmd,
                            "Failed to read file for base64://{}: {e}",
                            file_path
                        );
                        Value::String(s)
                    }
                }
            }
            Value::String(s) if s.starts_with(MCP_PREFIX) => {
                let hash = &s[MCP_PREFIX.len()..];
                self.resolve_mcp_hash(hash, &s)
            }
            other => other,
        }
    }

    pub fn materialize(&self, mut result: CallToolResult) -> Value {
        let content = std::mem::take(&mut result.content);
        let mut modified = false;

        let processed: Vec<ContentBlock> = content
            .into_iter()
            .map(|block| match block {
                ContentBlock::Image(img) => {
                    match self.store_base64(&img.data, &img.mime_type) {
                        Ok(hash) => {
                            modified = true;
                            ContentBlock::Image(ImageContent::new(hash, img.mime_type))
                        }
                        Err(_) => ContentBlock::Image(img),
                    }
                }
                ContentBlock::Audio(audio) => {
                    match self.store_base64(&audio.data, &audio.mime_type) {
                        Ok(hash) => {
                            modified = true;
                            ContentBlock::Audio(AudioContent::new(hash, audio.mime_type))
                        }
                        Err(_) => ContentBlock::Audio(audio),
                    }
                }
                other => other,
            })
            .collect();

        if modified {
            logging!(debug, Type::Cmd, "Materialized base64 content to moka cache");
        }

        let mut value = serde_json::to_value(result).unwrap_or_default();
        if let Ok(content_json) = serde_json::to_value(&processed) {
            value["content"] = content_json;
        }
        value
    }

    fn store_base64(&self, data: &str, mime_type: &str) -> Result<String, ()> {
        let decoded = STANDARD.decode(data).map_err(|e| {
                logging!(warn, Type::Cmd, "Failed to decode base64: {e}");
            })?;

        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(&decoded);
            hex::encode(hasher.finalize())
        };

        self.insert(hash.clone(), (mime_type.to_string(), decoded));
        Ok(hash)
    }
}

pub fn mcp_protocol_handler(
    _ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let hash = request.uri().path().trim_start_matches('/').to_string();
    let store = McpContentStore::global();

    match store.get(&hash) {
        Some((mime, bytes)) => {
            let mut response = Response::new(bytes);
            let headers = response.headers_mut();
            headers.insert(
                CONTENT_TYPE,
                HeaderValue::from_str(&mime)
                    .unwrap_or(HeaderValue::from_static("application/octet-stream")),
            );
            headers.insert(ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
            response
        }
        None => {
            logging!(warn, Type::System, "mcp:// content not found: {hash}");
            let mut response = Response::new(b"content not found".to_vec());
            *response.status_mut() = StatusCode::NOT_FOUND;
            response
                .headers_mut()
                .insert(CONTENT_TYPE, HeaderValue::from_static("text/plain"));
            response
        }
    }
}
