pub mod dirs;

use anyhow::Result;
use draft::Draft;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::OnceLock;

use mcp::McpServerConfig;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FrontendConfig {
    pub home: String,
    #[serde(default = "default_mode")]
    pub mode: String,
}

fn default_mode() -> String {
    "dark".to_string()
}

impl Default for FrontendConfig {
    fn default() -> Self {
        Self {
            home: "overview".to_string(),
            mode: default_mode(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Config {
    pub log_level: String,
    #[serde(default = "default_shell")]
    pub shell: String,
    #[serde(default)]
    pub frontend: FrontendConfig,
    #[serde(default, alias = "mcp_servers")]
    pub mcp: HashMap<String, McpServerConfig>,
}

fn default_shell() -> String {
    "auto".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            log_level: "info".to_string(),
            shell: default_shell(),
            frontend: FrontendConfig::default(),
            mcp: HashMap::new(),
        }
    }
}

static CONFIG_INSTANCE: OnceLock<Draft<Config>> = OnceLock::new();

impl Config {
    fn load_from_file(path: &Path) -> Result<Self> {
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
            Ok(path) => match Config::load_from_file(&path) {
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

    pub fn save_global() -> Result<()> {
        let config = Config::global();
        config.apply();
        let data = config.data_arc();
        let path = dirs::config_file()?;
        let content = serde_json::to_string_pretty(&*data)?;
        std::fs::write(&path, content)?;
        log::info!(target: "app", "[Config] Config saved to disk");
        Ok(())
    }
}
