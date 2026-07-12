mod common;

use mcp::{McpError, McpEvent};
use std::time::Duration;

#[tokio::test(flavor = "multi_thread")]
async fn test_server_not_found() {
    let manager = common::make_manager(vec![]).await;

    let err = manager.start_server("nonexistent").await.unwrap_err();
    assert!(
        matches!(err, McpError::ServerNotFound { ref name } if name == "nonexistent"),
        "expected ServerNotFound, got: {}",
        err
    );

    let err = manager.stop_server("nonexistent").await.unwrap_err();
    assert!(matches!(err, McpError::ServerNotFound { .. }));

    let err = manager.restart_server("nonexistent").await.unwrap_err();
    assert!(matches!(err, McpError::ServerNotFound { .. }));

    let err = manager.server_status("nonexistent").await.unwrap_err();
    assert!(matches!(err, McpError::ServerNotFound { .. }));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_disabled_server_returns_not_found() {
    let config = mcp::McpServerConfig::Local {
        command: vec!["echo".into()],
        environment: None,
        enabled: false,
        timeout: common::TIMEOUT,
    };
    let manager = common::make_manager(vec![("disabled-srv".into(), config)]).await;

    let err = manager.start_server("disabled-srv").await.unwrap_err();
    assert!(
        matches!(err, McpError::ServerNotFound { ref name } if name == "disabled-srv"),
        "expected ServerNotFound for disabled server, got: {}",
        err
    );

    let err = manager.server_status("disabled-srv").await.unwrap_err();
    assert!(matches!(err, McpError::ServerNotFound { .. }));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_tools_empty() {
    let manager = common::make_manager(vec![]).await;
    let tools = manager.list_tools().await;
    assert!(tools.is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn test_event_subscription() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    let mut rx = manager.subscribe();

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(event, McpEvent::ServerReady { name } if name == "everything"));

    manager.stop_server("everything").await.unwrap();

    let event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(event, McpEvent::ServerStopped { name } if name == "everything"));
}
