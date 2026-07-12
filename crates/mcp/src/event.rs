use serde::Serialize;

/// MCP 服务器事件
#[derive(Debug, Clone, Serialize)]
pub enum McpEvent {
    /// 服务器正在启动
    ServerStarting { name: String },
    /// 服务器已就绪
    ServerReady { name: String },
    /// 服务器启动失败或运行中出错
    ServerFailed { name: String, error: String },
    /// 服务器已停止
    ServerStopped { name: String },
}

impl McpEvent {
    /// 获取事件对应的服务器名称
    pub fn server_name(&self) -> &str {
        match self {
            McpEvent::ServerStarting { name } => name,
            McpEvent::ServerReady { name } => name,
            McpEvent::ServerFailed { name, .. } => name,
            McpEvent::ServerStopped { name } => name,
        }
    }
}

/// 服务器状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ServerStatus {
    /// 正在启动
    Starting,
    /// 运行中
    Running,
    /// 已停止
    Stopped,
    /// 启动失败或运行中出错
    Failed { error: String },
}
