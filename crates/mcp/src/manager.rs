use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{broadcast, RwLock};
use tracing::warn;

use crate::config::McpServerConfig;
use crate::error::McpError;
use crate::event::{McpEvent, ServerStatus};
use crate::server::McpServer;
use crate::ToolInfo;

/// MCP 服务器管理器
///
/// 提供 MCP 服务器的生命周期管理、工具发现和调用路由功能。
pub struct McpManager {
    /// 服务器实例
    servers: Arc<RwLock<HashMap<String, McpServer>>>,
    /// 事件发送器
    event_tx: broadcast::Sender<McpEvent>,
}

impl McpManager {
    /// 创建新的管理器
    ///
    /// # Arguments
    /// * `servers` - 服务器配置，key 为服务器名称
    ///
    /// 注意：`enabled: false` 的服务器会被过滤掉，不会进入管理器。
    /// 对 disabled 服务器调用任何操作都会返回 `McpError::ServerNotFound`。
    pub fn new(servers: HashMap<String, McpServerConfig>) -> Self {
        let (event_tx, _) = broadcast::channel(100);
        let mut server_map = HashMap::new();

        for (name, config) in servers.into_iter().filter(|(_, config)| config.is_enabled()) {
            server_map.insert(name.clone(), McpServer::new(name, config));
        }

        Self {
            servers: Arc::new(RwLock::new(server_map)),
            event_tx,
        }
    }

    /// 订阅服务器事件
    pub fn subscribe(&self) -> broadcast::Receiver<McpEvent> {
        self.event_tx.subscribe()
    }

    /// 启动指定服务器
    pub async fn start_server(&self, name: &str) -> Result<(), McpError> {
        let mut servers = self.servers.write().await;
        let server = servers
            .get_mut(name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: name.to_string(),
            })?;

        let event = server.start().await.map_err(|e| {
            let _ = self.event_tx.send(McpEvent::ServerFailed {
                name: name.to_string(),
                error: e.to_string(),
            });
            e
        })?;

        let _ = self.event_tx.send(event);
        Ok(())
    }

    /// 停止指定服务器
    pub async fn stop_server(&self, name: &str) -> Result<(), McpError> {
        let mut servers = self.servers.write().await;
        let server = servers
            .get_mut(name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: name.to_string(),
            })?;

        let event = server.stop().await?;
        let _ = self.event_tx.send(event);
        Ok(())
    }

    /// 重启指定服务器
    pub async fn restart_server(&self, name: &str) -> Result<(), McpError> {
        let mut servers = self.servers.write().await;
        let server = servers
            .get_mut(name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: name.to_string(),
            })?;

        let events = server.restart().await?;
        for event in events {
            let _ = self.event_tx.send(event);
        }
        Ok(())
    }

    /// 查询服务器状态
    pub async fn server_status(&self, name: &str) -> Result<ServerStatus, McpError> {
        let servers = self.servers.read().await;
        let server = servers
            .get(name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: name.to_string(),
            })?;

        Ok(server.status().clone())
    }

    /// 列出所有运行中服务器的工具
    pub async fn list_tools(&self) -> Vec<ToolInfo> {
        let servers = self.servers.read().await;
        let mut all_tools = Vec::new();

        for (name, server) in servers.iter() {
            if !matches!(server.status(), ServerStatus::Running) {
                continue;
            }

            match server.list_tools(None).await {
                Ok(result) => {
                    for tool in result.tools {
                        all_tools.push(ToolInfo {
                            server_name: name.clone(),
                            tool,
                        });
                    }
                }
                Err(e) => {
                    warn!("failed to list tools from '{}': {}", name, e);
                }
            }
        }

        all_tools
    }

    /// 调用指定服务器的工具
    pub async fn call_tool(
        &self,
        server_name: &str,
        tool_name: &str,
        arguments: Option<serde_json::Value>,
    ) -> Result<rmcp::model::CallToolResult, McpError> {
        let servers = self.servers.read().await;
        let server = servers
            .get(server_name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: server_name.to_string(),
            })?;

        server.call_tool(tool_name, arguments).await
    }
}
