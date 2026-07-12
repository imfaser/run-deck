use mcp::McpError;

#[test]
fn test_error_clone() {
    let errors = vec![
        McpError::ServerNotFound { name: "test".into() },
        McpError::AlreadyRunning { name: "test".into() },
        McpError::AlreadyStopped { name: "test".into() },
        McpError::StillStarting { name: "test".into() },
        McpError::NotRunning { name: "test".into() },
        McpError::EmptyCommand { name: "test".into() },
        McpError::InvalidArguments { value: "bad".into() },
        McpError::Timeout { name: "test".into() },
        McpError::StartupFailed { name: "test".into(), error: "err".into() },
        McpError::SpawnFailed { name: "test".into(), error: "err".into() },
        McpError::CallToolFailed { server: "s".into(), tool: "t".into(), error: "e".into() },
        McpError::InvalidHeaderName { name: "h".into(), error: "e".into() },
        McpError::InvalidHeaderValue { name: "h".into(), error: "e".into() },
    ];

    for err in errors {
        let cloned = err.clone();
        assert_eq!(err.to_string(), cloned.to_string());
    }
}

#[test]
fn test_error_display() {
    let err = McpError::ServerNotFound { name: "my-server".into() };
    assert_eq!(err.to_string(), "server 'my-server' not found");

    let err = McpError::AlreadyRunning { name: "my-server".into() };
    assert_eq!(err.to_string(), "server 'my-server' is already running");

    let err = McpError::AlreadyStopped { name: "my-server".into() };
    assert_eq!(err.to_string(), "server 'my-server' is already stopped");

    let err = McpError::StillStarting { name: "my-server".into() };
    assert_eq!(err.to_string(), "server 'my-server' is still starting");

    let err = McpError::NotRunning { name: "my-server".into() };
    assert_eq!(err.to_string(), "server 'my-server' is not running");

    let err = McpError::EmptyCommand { name: "my-server".into() };
    assert_eq!(err.to_string(), "command is empty for server 'my-server'");

    let err = McpError::InvalidArguments { value: "\"bad\"".into() };
    assert_eq!(err.to_string(), "tool arguments must be a JSON object, got: \"bad\"");

    let err = McpError::Timeout { name: "my-server".into() };
    assert_eq!(err.to_string(), "timed out starting server 'my-server'");

    let err = McpError::StartupFailed { name: "my-server".into(), error: "conn refused".into() };
    assert_eq!(err.to_string(), "failed to start server 'my-server': conn refused");

    let err = McpError::SpawnFailed { name: "my-server".into(), error: "not found".into() };
    assert_eq!(err.to_string(), "failed to spawn process for 'my-server': not found");

    let err = McpError::CallToolFailed {
        server: "srv".into(),
        tool: "tool".into(),
        error: "fail".into(),
    };
    assert_eq!(err.to_string(), "failed to call tool 'tool' on 'srv': fail");

    let err = McpError::InvalidHeaderName { name: "bad".into(), error: "invalid".into() };
    assert_eq!(err.to_string(), "invalid header name 'bad': invalid");

    let err = McpError::InvalidHeaderValue { name: "bad".into(), error: "invalid".into() };
    assert_eq!(err.to_string(), "invalid header value for 'bad': invalid");
}

#[test]
fn test_error_debug() {
    let err = McpError::ServerNotFound { name: "test".into() };
    let debug = format!("{:?}", err);
    assert!(debug.contains("ServerNotFound"));
    assert!(debug.contains("test"));
}

#[test]
fn test_error_is_send_sync() {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<McpError>();
}
