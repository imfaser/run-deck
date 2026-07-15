use std::collections::HashMap;
use std::sync::Arc;

use logging::{logging, Type};
use rmcp::handler::client::progress::ProgressSubscriber;
use rmcp::model::ProgressToken;
use tokio::sync::{broadcast, RwLock};

use crate::config::McpServerConfig;
use crate::error::McpError;
use crate::event::{McpEvent, ServerStatus};
use crate::handler::McpLogEvent;
use crate::server::McpServer;
use crate::shell::ShellType;
use crate::{PromptInfo, ResourceInfo, ToolInfo};

/// MCP 服务器管理器
///
/// 提供 MCP 服务器的生命周期管理、工具发现和调用路由功能。
pub struct McpManager {
    /// 服务器实例
    servers: Arc<RwLock<HashMap<String, McpServer>>>,
    /// 事件发送器
    event_tx: broadcast::Sender<McpEvent>,
    /// 全局 Shell 配置
    shell: ShellType,
}

impl McpManager {
    /// 创建新的管理器
    ///
    /// # Arguments
    /// * `servers` - 服务器配置，key 为服务器名称
    /// * `shell` - 全局 Shell 配置，所有本地 MCP 服务器共用
    ///
    /// 注意：`enabled: false` 的服务器会被过滤掉，不会进入管理器。
    /// 对 disabled 服务器调用任何操作都会返回 `McpError::ServerNotFound`。
    pub fn new(servers: HashMap<String, McpServerConfig>, shell: ShellType) -> Self {
        let (event_tx, _) = broadcast::channel(100);
        let mut server_map = HashMap::new();

        for (name, config) in servers.into_iter().filter(|(_, config)| config.is_enabled()) {
            server_map.insert(name.clone(), McpServer::new(name, config));
        }

        logging!(info, Type::Mcp, "McpManager created with {} server(s), shell: {:?}", server_map.len(), shell);

        Self {
            servers: Arc::new(RwLock::new(server_map)),
            event_tx,
            shell,
        }
    }

    /// 订阅服务器事件
    pub fn subscribe(&self) -> broadcast::Receiver<McpEvent> {
        self.event_tx.subscribe()
    }

    /// 启动指定服务器
    pub async fn start_server(&self, name: &str) -> Result<(), McpError> {
        logging!(debug, Type::Mcp, "Acquiring write lock to start server '{}'", name);
        let mut servers = self.servers.write().await;
        let server = servers
            .get_mut(name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: name.to_string(),
            })?;

        let event = server.start(&self.shell).await.map_err(|e| {
            let _ = self.event_tx.send(McpEvent::ServerFailed {
                name: name.to_string(),
                error: e.to_string(),
            });
            e
        })?;

        logging!(info, Type::Mcp, "Server '{}' started", name);
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
        logging!(info, Type::Mcp, "Server '{}' stopped", name);
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

        logging!(info, Type::Mcp, "Restarting server '{}'", name);
        let events = server.restart(&self.shell).await?;
        for event in events {
            let _ = self.event_tx.send(event);
        }
        Ok(())
    }

    /// 查询服务器状态
    pub async fn server_status(&self, name: &str) -> Result<ServerStatus, McpError> {
        logging!(debug, Type::Mcp, "Querying status for server '{}'", name);
        let servers = self.servers.read().await;
        let server = servers
            .get(name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: name.to_string(),
            })?;

        Ok(server.status().clone())
    }

    /// 查询服务器信息（名称、版本、能力等）
    pub async fn server_info(
        &self,
        name: &str,
    ) -> Result<Option<crate::ServerInfo>, McpError> {
        logging!(debug, Type::Mcp, "Querying info for server '{}'", name);
        let servers = self.servers.read().await;
        let server = servers
            .get(name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: name.to_string(),
            })?;

        Ok(server.server_info().map(|info| {
            let caps = &info.capabilities;
            crate::ServerInfo {
                name: info.server_info.name.to_string(),
                version: info.server_info.version.to_string(),
                has_tools: caps.tools.is_some(),
                has_prompts: caps.prompts.is_some(),
                has_resources: caps.resources.is_some(),
            }
        }))
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
                    logging!(debug, Type::Mcp, "Server '{}' returned {} tool(s)", name, result.tools.len());
                    for tool in result.tools {
                        all_tools.push(ToolInfo {
                            server_name: name.clone(),
                            tool,
                        });
                    }
                }
                Err(e) => {
                    logging!(warn, Type::Mcp, "Failed to list tools from '{}': {}", name, e);
                }
            }
        }

        logging!(info, Type::Mcp, "Discovered {} tool(s) total", all_tools.len());
        all_tools
    }

    /// 列出所有运行中服务器的提示
    pub async fn list_prompts(&self) -> Vec<PromptInfo> {
        let servers = self.servers.read().await;
        let mut all_prompts = Vec::new();

        for (name, server) in servers.iter() {
            if !matches!(server.status(), ServerStatus::Running) {
                continue;
            }

            match server.list_prompts().await {
                Ok(prompts) => {
                    logging!(debug, Type::Mcp, "Server '{}' returned {} prompt(s)", name, prompts.len());
                    for prompt in prompts {
                        all_prompts.push(PromptInfo {
                            server_name: name.clone(),
                            prompt,
                        });
                    }
                }
                Err(e) => {
                    logging!(warn, Type::Mcp, "Failed to list prompts from '{}': {}", name, e);
                }
            }
        }

        logging!(info, Type::Mcp, "Discovered {} prompt(s) total", all_prompts.len());
        all_prompts
    }

    /// 列出所有运行中服务器的资源
    pub async fn list_resources(&self) -> Vec<ResourceInfo> {
        let servers = self.servers.read().await;
        let mut all_resources = Vec::new();

        for (name, server) in servers.iter() {
            if !matches!(server.status(), ServerStatus::Running) {
                continue;
            }

            match server.list_resources().await {
                Ok(resources) => {
                    logging!(debug, Type::Mcp, "Server '{}' returned {} resource(s)", name, resources.len());
                    for resource in resources {
                        all_resources.push(ResourceInfo {
                            server_name: name.clone(),
                            resource,
                        });
                    }
                }
                Err(e) => {
                    logging!(warn, Type::Mcp, "Failed to list resources from '{}': {}", name, e);
                }
            }
        }

        logging!(info, Type::Mcp, "Discovered {} resource(s) total", all_resources.len());
        all_resources
    }

    /// 停止所有服务器
    pub async fn stop_all(&self) {
        let mut servers = self.servers.write().await;
        for (name, server) in servers.iter_mut() {
            match server.stop().await {
                Ok(_) => {}
                Err(McpError::AlreadyStopped { .. }) => {}
                Err(e) => {
                    logging!(warn, Type::Mcp, "Failed to stop server '{}' during shutdown: {}", name, e);
                }
            }
        }
        logging!(info, Type::Mcp, "All MCP servers stopped");
    }

    /// 调用指定服务器的工具
    pub async fn call_tool(
        &self,
        server_name: &str,
        tool_name: &str,
        arguments: Option<serde_json::Value>,
    ) -> Result<rmcp::model::CallToolResult, McpError> {
        logging!(debug, Type::Mcp, "Calling tool '{}' on server '{}'", tool_name, server_name);
        let servers = self.servers.read().await;
        let server = servers
            .get(server_name)
            .ok_or_else(|| McpError::ServerNotFound {
                name: server_name.to_string(),
            })?;

        server.call_tool(tool_name, arguments).await
    }

    /// 调用指定服务器的工具，同时返回进度流和日志接收器
    ///
    /// 返回 `(CallToolResult, ProgressSubscriber, broadcast::Receiver<McpLogEvent>)`。
    /// `ProgressSubscriber` 实现 `Stream<Item = ProgressNotificationParam>`，
    /// drop 时自动取消订阅。`broadcast::Receiver` 接收服务端日志通知。
    pub async fn call_tool_with_progress(
        &self,
        server_name: &str,
        tool_name: &str,
        arguments: Option<serde_json::Value>,
    ) -> Result<
        (
            rmcp::model::CallToolResult,
            ProgressSubscriber,
            broadcast::Receiver<McpLogEvent>,
        ),
        McpError,
    > {
        logging!(
            debug,
            Type::Mcp,
            "Calling tool '{}' on server '{}' with progress",
            tool_name,
            server_name
        );

        // 先订阅 log，避免丢失启动阶段的日志
        let log_rx = {
            let servers = self.servers.read().await;
            let server = servers
                .get(server_name)
                .ok_or_else(|| McpError::ServerNotFound {
                    name: server_name.to_string(),
                })?;
            server.subscribe_log()
        };

        // 生成 progress token 并订阅
        let progress_token = ProgressToken(rmcp::model::NumberOrString::String(
            format!("{}-{}", server_name, tool_name).into(),
        ));
        let progress_subscriber = {
            let servers = self.servers.read().await;
            let server = servers
                .get(server_name)
                .ok_or_else(|| McpError::ServerNotFound {
                    name: server_name.to_string(),
                })?;
            let dispatcher = server.progress_dispatcher().ok_or_else(|| McpError::NotRunning {
                name: server_name.to_string(),
            })?;
            dispatcher.subscribe(progress_token).await
        };

        // 执行 tool 调用
        let result = self.call_tool(server_name, tool_name, arguments).await?;

        Ok((result, progress_subscriber, log_rx))
    }
}
