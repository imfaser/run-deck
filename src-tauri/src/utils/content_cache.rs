use crate::config::dirs;
use crate::singleton;
use anyhow::Result;
use logging::{logging, Type};
use sha2::{Digest as _, Sha256};
use std::path::PathBuf;

#[derive(Debug)]
pub struct ContentCache {
    cache_dir: PathBuf,
}

impl ContentCache {
    pub fn new() -> Self {
        let cache_dir =
            dirs::app_cache_dir().expect("failed to resolve cache dir");
        std::fs::create_dir_all(&cache_dir)
            .expect("failed to create cache dir");
        Self { cache_dir }
    }

    pub fn cache_dir(&self) -> &PathBuf {
        &self.cache_dir
    }

    /// 存字节 → hash（已存在则跳过写入）
    pub async fn store_bytes(&self, data: &[u8]) -> Result<String> {
        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(data);
            hex::encode(hasher.finalize())
        };

        let path = self.cache_dir.join(&hash);
        if !path.exists() {
            tokio::fs::write(&path, data).await?;
            logging!(debug, Type::Cmd, "Cached {} bytes, hash={hash}", data.len());
        } else {
            logging!(debug, Type::Cmd, "Cache hit, hash={hash}");
        }

        Ok(hash)
    }

    /// 存文件 → hash
    pub async fn store_file(&self, path: &str) -> Result<String> {
        let data = tokio::fs::read(path)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read file {path}: {e}"))?;
        self.store_bytes(&data).await
    }

    /// 路径文件 → 拷贝到缓存 → hash（同步，供 Tauri command 用）
    pub fn store_path(&self, path: &str) -> Result<String> {
        let data = std::fs::read(path)
            .map_err(|e| anyhow::anyhow!("Failed to read file {path}: {e}"))?;
        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(&data);
            hex::encode(hasher.finalize())
        };
        let dest = self.cache_dir.join(&hash);
        if !dest.exists() {
            std::fs::write(&dest, &data)?;
            logging!(debug, Type::Cmd, "Cached {} bytes from path, hash={hash}", data.len());
        }
        Ok(hash)
    }

    /// 取路径（同步，供 raw3d 等同步上下文用）
    pub fn get_path(&self, hash: &str) -> PathBuf {
        self.cache_dir.join(hash)
    }

    /// base64 字符串 → 解码 → 存储 → hash（同步）
    pub fn store_base64(&self, b64: &str) -> Result<String> {
        use base64::Engine as _;
        let decoded = base64::engine::general_purpose::STANDARD.decode(b64)?;
        let hash = {
            let mut hasher = Sha256::new();
            hasher.update(&decoded);
            hex::encode(hasher.finalize())
        };
        let path = self.cache_dir.join(&hash);
        if !path.exists() {
            std::fs::write(&path, &decoded)?;
        }
        Ok(hash)
    }

    /// 清理缓存目录
    pub fn cleanup(&self) {
        if self.cache_dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&self.cache_dir) {
                logging!(warn, Type::System, "Failed to clean cache dir: {e}");
            } else {
                logging!(
                    info,
                    Type::System,
                    "Cache dir cleaned: {}",
                    self.cache_dir.display()
                );
            }
        }
    }
}

singleton!(ContentCache, CONTENT_CACHE);
