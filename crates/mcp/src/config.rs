use std::collections::HashMap;

use crate::shell::ShellType;

/// MCP 服务器配置
///
/// 参考 opencode 的配置格式，支持两种类型：
/// - `Local`: 本地 stdio 服务器
/// - `Remote`: 远程 HTTP 服务器
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum McpServerConfig {
    /// 本地 stdio 服务器
    Local {
        /// 启动命令及参数
        command: Vec<String>,
        /// Shell 类型
        #[serde(default)]
        shell: ShellType,
        /// 环境变量
        #[serde(default)]
        environment: Option<HashMap<String, String>>,
        /// 是否启用
        #[serde(default = "default_enabled")]
        enabled: bool,
        /// 超时时间（毫秒）
        #[serde(default)]
        timeout: Option<u64>,
    },
    /// 远程 HTTP 服务器
    Remote {
        /// 服务器 URL
        url: String,
        /// 请求头
        #[serde(default)]
        headers: Option<HashMap<String, String>>,
        /// 是否启用
        #[serde(default = "default_enabled")]
        enabled: bool,
        /// 超时时间（毫秒）
        #[serde(default)]
        timeout: Option<u64>,
    },
}

fn default_enabled() -> bool {
    true
}

impl McpServerConfig {
    /// 是否启用
    pub fn is_enabled(&self) -> bool {
        match self {
            McpServerConfig::Local { enabled, .. } => *enabled,
            McpServerConfig::Remote { enabled, .. } => *enabled,
        }
    }

    /// 获取超时时间（毫秒）
    pub fn timeout_ms(&self) -> Option<u64> {
        match self {
            McpServerConfig::Local { timeout, .. } => *timeout,
            McpServerConfig::Remote { timeout, .. } => *timeout,
        }
    }
}
