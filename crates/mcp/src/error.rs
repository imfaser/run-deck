/// MCP 服务器错误类型
///
/// 覆盖所有边界情况，消费端可精确匹配错误变体。
#[derive(Debug, Clone, thiserror::Error)]
pub enum McpError {
    #[error("server '{name}' not found")]
    ServerNotFound { name: String },

    #[error("server '{name}' is already running")]
    AlreadyRunning { name: String },

    #[error("server '{name}' is already stopped")]
    AlreadyStopped { name: String },

    #[error("server '{name}' is still starting")]
    StillStarting { name: String },

    #[error("server '{name}' is not running")]
    NotRunning { name: String },

    #[error("command is empty for server '{name}'")]
    EmptyCommand { name: String },

    #[error("tool arguments must be a JSON object, got: {value}")]
    InvalidArguments { value: String },

    #[error("timed out starting server '{name}'")]
    Timeout { name: String },

    #[error("timed out calling tool '{tool}' on server '{server}'")]
    CallTimeout { server: String, tool: String },

    #[error("failed to start server '{name}': {error}")]
    StartupFailed { name: String, error: String },

    #[error("failed to spawn process for '{name}': {error}")]
    SpawnFailed { name: String, error: String },

    #[error("failed to call tool '{tool}' on '{server}': {error}")]
    CallToolFailed {
        server: String,
        tool: String,
        error: String,
    },

    #[error("invalid header name '{name}': {error}")]
    InvalidHeaderName { name: String, error: String },

    #[error("invalid header value for '{name}': {error}")]
    InvalidHeaderValue { name: String, error: String },
}
