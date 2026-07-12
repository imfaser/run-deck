//! MCP 服务器管理库
//!
//! 提供独立的 MCP 服务器管理功能，支持：
//! - 启动、停止、重启 MCP 服务器
//! - 发现和聚合多个服务器的工具
//! - 将工具调用路由到正确的服务器
//! - 通过 tokio broadcast channel 发送状态事件

mod config;
mod error;
mod event;
mod manager;
pub mod shell;
mod server;

#[cfg(test)]
#[path = "config_tests.rs"]
mod config_tests;

#[cfg(test)]
#[path = "event_tests.rs"]
mod event_tests;

#[cfg(test)]
#[path = "shell_tests.rs"]
mod shell_tests;

pub use config::McpServerConfig;
pub use error::McpError;
pub use event::{McpEvent, ServerStatus};
pub use manager::McpManager;
pub use rmcp::model::CallToolResult;
pub use shell::ShellType;

use logging::{logging, Type};
use serde::Serialize;

/// 工具信息，包含服务器来源和工具定义
#[derive(Debug, Clone, Serialize)]
pub struct ToolInfo {
    /// 工具所属的服务器名称
    pub server_name: String,
    /// MCP 工具定义
    pub tool: rmcp::model::Tool,
}

/// 提示信息，包含服务器来源和提示定义
#[derive(Debug, Clone, Serialize)]
pub struct PromptInfo {
    /// 提示所属的服务器名称
    pub server_name: String,
    /// MCP 提示定义
    pub prompt: rmcp::model::Prompt,
}

/// 资源信息，包含服务器来源和资源定义
#[derive(Debug, Clone, Serialize)]
pub struct ResourceInfo {
    /// 资源所属的服务器名称
    pub server_name: String,
    /// MCP 资源定义
    pub resource: rmcp::model::Resource,
}

/// 服务器信息，从初始化结果中提取
#[derive(Debug, Clone, Serialize)]
pub struct ServerInfo {
    /// 服务器名称
    pub name: String,
    /// 服务器版本
    pub version: String,
    /// 是否支持工具
    pub has_tools: bool,
    /// 是否支持提示
    pub has_prompts: bool,
    /// 是否支持资源
    pub has_resources: bool,
}

pub fn log_message(level: log::Level, server_name: &str, tool_name: &str, message: &str) {
    match level {
        log::Level::Error => logging!(error, Type::Mcp, "server={}, tool={}, message={}", server_name, tool_name, message),
        log::Level::Warn => logging!(warn, Type::Mcp, "server={}, tool={}, message={}", server_name, tool_name, message),
        log::Level::Info => logging!(info, Type::Mcp, "server={}, tool={}, message={}", server_name, tool_name, message),
        log::Level::Debug => logging!(debug, Type::Mcp, "server={}, tool={}, message={}", server_name, tool_name, message),
        log::Level::Trace => logging!(trace, Type::Mcp, "server={}, tool={}, message={}", server_name, tool_name, message),
    }
}
