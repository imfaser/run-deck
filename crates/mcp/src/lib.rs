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
pub use shell::ShellType;

/// 工具信息，包含服务器来源和工具定义
#[derive(Debug, Clone)]
pub struct ToolInfo {
    /// 工具所属的服务器名称
    pub server_name: String,
    /// MCP 工具定义
    pub tool: rmcp::model::Tool,
}
