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
    #[serde(default = "default_log_level")]
    pub log_level: String,
    #[serde(default = "default_log_retention_days")]
    pub log_retention_days: u32,
    #[serde(default = "default_log_max_size_mb")]
    pub log_max_size_mb: u64,
    #[serde(default = "default_log_keep_files")]
    pub log_keep_files: usize,
    #[serde(default = "default_shell")]
    pub shell: String,
    #[serde(default)]
    pub frontend: FrontendConfig,
    #[serde(default, alias = "mcp_servers")]
    pub mcp: HashMap<String, McpServerConfig>,
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_log_retention_days() -> u32 {
    logging::DEFAULT_RETENTION_DAYS
}

fn default_log_max_size_mb() -> u64 {
    logging::DEFAULT_LOG_MAX_SIZE_MB
}

fn default_log_keep_files() -> usize {
    logging::KEEP_LOG_FILES
}

fn default_shell() -> String {
    "auto".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            log_level: default_log_level(),
            log_retention_days: default_log_retention_days(),
            log_max_size_mb: default_log_max_size_mb(),
            log_keep_files: default_log_keep_files(),
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
            log::info!(target: "app", "[Config] Loading config from: {}", path.display());
            let content = std::fs::read_to_string(path)?;
            let mut config: Config = serde_json::from_str(&content)?;
            let normalized = logging::normalize_log_level(&config.log_level);
            if normalized != config.log_level {
                log::warn!(target: "app", "[Config] Invalid log_level {:?}, falling back to {:?}", config.log_level, normalized);
                config.log_level = normalized.to_string();
            }
            log::info!(target: "app", "[Config] Config loaded successfully");
            Ok(config)
        } else {
            log::info!(target: "app", "[Config] Config file not found, creating default at: {}", path.display());
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let config = Config::default();
            let content = serde_json::to_string_pretty(&config)?;
            std::fs::write(path, content)?;
            log::info!(target: "app", "[Config] Default config created");
            Ok(config)
        }
    }

    pub fn global() -> &'static Draft<Config> {
        CONFIG_INSTANCE.get_or_init(|| {
            match dirs::config_file() {
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
            }
        })
    }

    pub fn save_global() -> Result<()> {
        let config = Config::global();
        config.apply();
        let data = config.data_arc();
        let path = dirs::config_file()?;
        log::info!(target: "app", "[Config] Saving config to: {}", path.display());

        let content = serde_json::to_string_pretty(&*data)?;
        std::fs::write(&path, content)?;
        log::info!(target: "app", "[Config] Config saved to disk");
        Ok(())
    }
}
