// LoggingMessageNotificationParam is deprecated upstream (SEP-2577) but still functional.
// We suppress the warning since we need to support current MCP servers.
#![expect(deprecated)]

use logging::{logging, Type};
use rmcp::handler::client::progress::ProgressDispatcher;
use rmcp::model::{
    CancelledNotificationParam, ClientInfo, LoggingLevel, LoggingMessageNotificationParam,
    ProgressNotificationParam,
};
use rmcp::service::{NotificationContext, RoleClient};
use rmcp::ClientHandler;
use serde::Serialize;
use tokio::sync::broadcast;

/// MCP 日志事件，从服务端 `notifications/message` 转发
#[derive(Debug, Clone, Serialize)]
pub struct McpLogEvent {
    pub level: McpLogLevel,
    pub logger: Option<String>,
    pub data: serde_json::Value,
}

/// 日志级别，映射自 rmcp 的 LoggingLevel
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum McpLogLevel {
    Debug,
    Info,
    Notice,
    Warning,
    Error,
    Critical,
    Alert,
    Emergency,
}

impl From<LoggingLevel> for McpLogLevel {
    fn from(level: LoggingLevel) -> Self {
        match level {
            LoggingLevel::Debug => Self::Debug,
            LoggingLevel::Info => Self::Info,
            LoggingLevel::Notice => Self::Notice,
            LoggingLevel::Warning => Self::Warning,
            LoggingLevel::Error => Self::Error,
            LoggingLevel::Critical => Self::Critical,
            LoggingLevel::Alert => Self::Alert,
            LoggingLevel::Emergency => Self::Emergency,
        }
    }
}

/// MCP 客户端通知处理器
///
/// 接收服务端推送的 progress 和 logging 通知，分发给订阅者。
#[derive(Clone)]
pub struct McpClientHandler {
    server_name: String,
    progress: ProgressDispatcher,
    log_tx: broadcast::Sender<McpLogEvent>,
}

impl McpClientHandler {
    pub fn new(server_name: String, log_tx: broadcast::Sender<McpLogEvent>) -> Self {
        Self {
            server_name,
            progress: ProgressDispatcher::new(),
            log_tx,
        }
    }

    /// 获取 ProgressDispatcher 引用，供 Manager 层订阅 progress
    pub fn progress_dispatcher(&self) -> &ProgressDispatcher {
        &self.progress
    }
}

impl ClientHandler for McpClientHandler {
    fn get_info(&self) -> ClientInfo {
        let client_info = rmcp::model::Implementation::new("run-deck", env!("CARGO_PKG_VERSION"));
        ClientInfo::new(rmcp::model::ClientCapabilities::default(), client_info)
    }

    async fn on_progress(
        &self,
        params: ProgressNotificationParam,
        _context: NotificationContext<RoleClient>,
    ) {
        self.progress.handle_notification(params).await;
    }

    async fn on_cancelled(
        &self,
        params: CancelledNotificationParam,
        _context: NotificationContext<RoleClient>,
    ) {
        logging!(
            warn,
            Type::Mcp,
            "[{}] request cancelled: {:?} — {}",
            self.server_name,
            params.request_id,
            params.reason.as_deref().unwrap_or("no reason")
        );
    }

    async fn on_logging_message(
        &self,
        params: LoggingMessageNotificationParam,
        _context: NotificationContext<RoleClient>,
    ) {
        let level: McpLogLevel = params.level.into();
        let logger = params.logger.as_deref().unwrap_or("mcp-server");
        let data_str = match &params.data {
            serde_json::Value::String(s) => s.clone(),
            other => other.to_string(),
        };

        // 输出到应用日志
        match level {
            McpLogLevel::Error | McpLogLevel::Critical | McpLogLevel::Alert | McpLogLevel::Emergency => {
                logging!(error, Type::Mcp, "[{}] {}: {}", self.server_name, logger, data_str);
            }
            McpLogLevel::Warning => {
                logging!(warn, Type::Mcp, "[{}] {}: {}", self.server_name, logger, data_str);
            }
            McpLogLevel::Info | McpLogLevel::Notice => {
                logging!(info, Type::Mcp, "[{}] {}: {}", self.server_name, logger, data_str);
            }
            McpLogLevel::Debug => {
                logging!(debug, Type::Mcp, "[{}] {}: {}", self.server_name, logger, data_str);
            }
        }

        // 广播给 Channel 订阅者
        let event = McpLogEvent {
            level,
            logger: params.logger,
            data: params.data,
        };
        let _ = self.log_tx.send(event);
    }
}
