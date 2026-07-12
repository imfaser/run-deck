pub mod dirs;

use anyhow::Result;
use draft::Draft;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::OnceLock;

use mcp::McpServerConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub log_level: String,
    #[serde(default)]
    pub mcp_servers: HashMap<String, McpServerConfig>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            log_level: "info".to_string(),
            mcp_servers: HashMap::new(),
        }
    }
}

pub static CONFIG_INSTANCE: OnceLock<Draft<Config>> = OnceLock::new();

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            let config: Config = serde_json::from_str(&content)?;
            Ok(config)
        } else {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let config = Config::default();
            let content = serde_json::to_string_pretty(&config)?;
            std::fs::write(path, content)?;
            Ok(config)
        }
    }

    pub fn global() -> &'static Draft<Config> {
        CONFIG_INSTANCE.get_or_init(|| match dirs::config_file() {
            Ok(path) => match Config::load(&path) {
                Ok(config) => Draft::new(config),
                Err(e) => {
                    log::warn!(target: "app", "[Config] Failed to load config, using defaults: {e}");
                    Draft::new(Config::default())
                }
            },
            Err(e) => {
                log::warn!(target: "app", "[Config] Failed to get config path, using defaults: {e}");
                Draft::new(Config::default())
            }
        })
    }
}
