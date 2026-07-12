use std::collections::HashMap;

use logging::{logging, Type};
use rmcp::model::CallToolResult;
use rmcp::model::ListToolsResult;
use rmcp::model::PaginatedRequestParams;
use rmcp::service::RoleClient;
use rmcp::service::RunningService;

use crate::McpServerConfig;
use crate::error::McpError;
use crate::event::{McpEvent, ServerStatus};
use crate::shell::{ShellType, wrap_command};

/// 单个 MCP 服务器的状态管理
pub(crate) struct McpServer {
    /// 服务器名称
    pub name: String,
    /// 服务器配置
    pub config: McpServerConfig,
    /// 当前状态
    status: ServerStatus,
    /// rmcp 客户端服务
    service: Option<RunningService<RoleClient, ()>>,
}

impl McpServer {
    /// 创建新的服务器实例
    pub fn new(name: String, config: McpServerConfig) -> Self {
        logging!(debug, Type::Mcp, "Creating server instance '{}'", name);
        Self {
            name,
            config,
            status: ServerStatus::Stopped,
            service: None,
        }
    }

    /// 获取当前状态
    pub fn status(&self) -> &ServerStatus {
        &self.status
    }

    /// 启动服务器
    pub async fn start(&mut self, shell: &ShellType) -> Result<McpEvent, McpError> {
        if matches!(self.status, ServerStatus::Running) {
            return Err(McpError::AlreadyRunning {
                name: self.name.clone(),
            });
        }

        if matches!(self.status, ServerStatus::Starting) {
            return Err(McpError::StillStarting {
                name: self.name.clone(),
            });
        }

        self.status = ServerStatus::Starting;

        match self.config.clone() {
            McpServerConfig::Local {
                command,
                environment,
                timeout,
                ..
            } => {
                logging!(debug, Type::Mcp, "Starting server '{}' as Local (stdio)", self.name);
                if let Err(e) = self.start_stdio(command, shell.clone(), environment, timeout).await {
                    self.status = ServerStatus::Failed {
                        error: e.to_string(),
                    };
                    return Err(e);
                }
            }
            McpServerConfig::Remote {
                url,
                headers,
                timeout,
                ..
            } => {
                logging!(debug, Type::Mcp, "Starting server '{}' as Remote (http)", self.name);
                if let Err(e) = self.start_http(url, headers, timeout).await {
                    self.status = ServerStatus::Failed {
                        error: e.to_string(),
                    };
                    return Err(e);
                }
            }
        }

        self.status = ServerStatus::Running;
        logging!(info, Type::Mcp, "Server '{}' started successfully", self.name);

        Ok(McpEvent::ServerReady {
            name: self.name.clone(),
        })
    }

    /// 停止服务器
    pub async fn stop(&mut self) -> Result<McpEvent, McpError> {
        match &self.status {
            ServerStatus::Stopped => {
                return Err(McpError::AlreadyStopped {
                    name: self.name.clone(),
                });
            }
            ServerStatus::Starting => {
                return Err(McpError::StillStarting {
                    name: self.name.clone(),
                });
            }
            _ => {}
        }

        self.service.take();

        self.status = ServerStatus::Stopped;
        logging!(info, Type::Mcp, "Server '{}' stopped", self.name);

        Ok(McpEvent::ServerStopped {
            name: self.name.clone(),
        })
    }

    /// 重启服务器
    pub async fn restart(&mut self, shell: &ShellType) -> Result<Vec<McpEvent>, McpError> {
        if matches!(self.status, ServerStatus::Starting) {
            return Err(McpError::StillStarting {
                name: self.name.clone(),
            });
        }

        logging!(info, Type::Mcp, "Restarting server '{}'", self.name);
        let mut events = Vec::new();

        // 如果正在运行或已失败，先停止
        if matches!(self.status, ServerStatus::Running | ServerStatus::Failed { .. }) {
            let stop_event = self.stop().await?;
            events.push(stop_event);
        }

        // 重新启动
        let start_event = self.start(shell).await?;
        events.push(start_event);

        Ok(events)
    }

    /// 列出工具
    pub async fn list_tools(
        &self,
        params: Option<PaginatedRequestParams>,
    ) -> Result<ListToolsResult, McpError> {
        let service = self.service.as_ref().ok_or_else(|| McpError::NotRunning {
            name: self.name.clone(),
        })?;

        let result = service
            .list_tools(params)
            .await
            .map_err(|e| McpError::CallToolFailed {
                server: self.name.clone(),
                tool: "list_tools".to_string(),
                error: e.to_string(),
            })?;

        logging!(debug, Type::Mcp, "Server '{}' listed {} tool(s)", self.name, result.tools.len());
        Ok(result)
    }

    /// 调用工具
    pub async fn call_tool(
        &self,
        tool_name: &str,
        arguments: Option<serde_json::Value>,
    ) -> Result<CallToolResult, McpError> {
        let service = self.service.as_ref().ok_or_else(|| McpError::NotRunning {
            name: self.name.clone(),
        })?;

        logging!(debug, Type::Mcp, "Server '{}' calling tool '{}'", self.name, tool_name);

        let arguments = match arguments {
            Some(serde_json::Value::Object(map)) => Some(map),
            Some(other) => {
                return Err(McpError::InvalidArguments {
                    value: other.to_string(),
                });
            }
            None => None,
        };

        let mut params = rmcp::model::CallToolRequestParams::new(tool_name.to_string());
        params.arguments = arguments;

        service
            .call_tool(params)
            .await
            .map_err(|e| McpError::CallToolFailed {
                server: self.name.clone(),
                tool: tool_name.to_string(),
                error: e.to_string(),
            })
    }

    /// 启动 stdio 服务器
    async fn start_stdio(
        &mut self,
        command: Vec<String>,
        shell: ShellType,
        environment: Option<HashMap<String, String>>,
        timeout: Option<u64>,
    ) -> Result<(), McpError> {
        use std::process::Stdio;
        use tokio::process::Command;

        if command.is_empty() {
            return Err(McpError::EmptyCommand {
                name: self.name.clone(),
            });
        }

        let wrapped_command = wrap_command(&shell, &command);
        logging!(debug, Type::Mcp, "Server '{}' spawning command: {:?} (shell: {:?})", self.name, wrapped_command, shell);

        let program = &wrapped_command[0];
        let args = if wrapped_command.len() > 1 {
            &wrapped_command[1..]
        } else {
            &[]
        };

        let mut cmd = Command::new(program);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .kill_on_drop(true);

        // 设置环境变量
        if let Some(env) = environment {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        // 使用 rmcp 的 TokioChildProcess 传输
        let (transport, _stderr) = rmcp::transport::TokioChildProcess::builder(cmd)
            .spawn()
            .map_err(|e| McpError::SpawnFailed {
                name: self.name.clone(),
                error: e.to_string(),
            })?;

        // 通过 serve_client 建立连接并自动完成初始化握手
        let timeout_duration = timeout.map(std::time::Duration::from_millis);
        let service = match timeout_duration {
            Some(duration) => {
                tokio::time::timeout(
                    duration,
                    rmcp::service::serve_client((), transport),
                )
                .await
                .map_err(|_| McpError::Timeout {
                    name: self.name.clone(),
                })?
                .map_err(|e| McpError::StartupFailed {
                    name: self.name.clone(),
                    error: e.to_string(),
                })?
            }
            None => rmcp::service::serve_client((), transport)
                .await
                .map_err(|e| McpError::StartupFailed {
                    name: self.name.clone(),
                    error: e.to_string(),
                })?,
        };

        self.service = Some(service);
        Ok(())
    }

    /// 启动 HTTP 服务器
    async fn start_http(
        &mut self,
        url: String,
        headers: Option<HashMap<String, String>>,
        timeout: Option<u64>,
    ) -> Result<(), McpError> {
        use http::{HeaderName, HeaderValue};
        use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig;
        use rmcp::transport::StreamableHttpClientTransport;

        logging!(debug, Type::Mcp, "Server '{}' connecting to {}", self.name, url);

        // 构建自定义 headers
        let mut custom_headers = HashMap::new();
        if let Some(headers) = headers {
            for (key, value) in headers {
                let name = HeaderName::from_bytes(key.as_bytes()).map_err(|e| {
                    McpError::InvalidHeaderName {
                        name: key.clone(),
                        error: e.to_string(),
                    }
                })?;
                let val = HeaderValue::from_str(&value).map_err(|e| {
                    McpError::InvalidHeaderValue {
                        name: key.clone(),
                        error: e.to_string(),
                    }
                })?;
                custom_headers.insert(name, val);
            }
        }

        // 使用配置创建 transport
        let config = StreamableHttpClientTransportConfig::with_uri(url.as_str())
            .custom_headers(custom_headers);

        let transport = StreamableHttpClientTransport::from_config(config);

        // 通过 serve_client 建立连接并自动完成初始化握手
        let timeout_duration = timeout.map(std::time::Duration::from_millis);
        let service = match timeout_duration {
            Some(duration) => {
                tokio::time::timeout(
                    duration,
                    rmcp::service::serve_client((), transport),
                )
                .await
                .map_err(|_| McpError::Timeout {
                    name: self.name.clone(),
                })?
                .map_err(|e| McpError::StartupFailed {
                    name: self.name.clone(),
                    error: e.to_string(),
                })?
            }
            None => rmcp::service::serve_client((), transport)
                .await
                .map_err(|e| McpError::StartupFailed {
                    name: self.name.clone(),
                    error: e.to_string(),
                })?,
        };

        self.service = Some(service);
        Ok(())
    }
}
