mod common;

use mcp::{McpError, McpServerConfig, ServerStatus};

#[tokio::test(flavor = "multi_thread")]
async fn test_stop_already_stopped() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    let err = manager.stop_server("everything").await.unwrap_err();
    assert!(
        matches!(err, McpError::AlreadyStopped { ref name } if name == "everything"),
        "expected AlreadyStopped, got: {}",
        err
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_start_already_running() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let err = manager.start_server("everything").await.unwrap_err();
    assert!(
        matches!(err, McpError::AlreadyRunning { ref name } if name == "everything"),
        "expected AlreadyRunning, got: {}",
        err
    );

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_call_tool_on_stopped() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    let err = manager
        .call_tool(
            "everything",
            "echo",
            Some(serde_json::json!({"message": "hi"})),
        )
        .await
        .unwrap_err();
    assert!(
        matches!(err, McpError::NotRunning { ref name } if name == "everything"),
        "expected NotRunning, got: {}",
        err
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_call_tool_non_object_args() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let err = manager
        .call_tool(
            "everything",
            "echo",
            Some(serde_json::Value::String("not an object".into())),
        )
        .await
        .unwrap_err();
    assert!(
        matches!(err, McpError::InvalidArguments { .. }),
        "expected InvalidArguments, got: {}",
        err
    );

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_start_timeout() {
    let config = McpServerConfig::Local {
        command: vec![
            "npx".into(),
            "-y".into(),
            "@modelcontextprotocol/server-everything".into(),
        ],
        shell: mcp::ShellType::Auto,
        environment: None,
        enabled: true,
        timeout: Some(1),
    };
    let manager = common::make_manager(vec![("everything".into(), config)]).await;

    let err = manager.start_server("everything").await.unwrap_err();
    assert!(
        matches!(err, McpError::Timeout { ref name } if name == "everything"),
        "expected Timeout, got: {}",
        err
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_start_invalid_command() {
    let config = McpServerConfig::Local {
        command: vec!["this_program_definitely_does_not_exist_xyz".into()],
        shell: mcp::ShellType::Auto,
        environment: None,
        enabled: true,
        timeout: Some(5000),
    };
    let manager = common::make_manager(vec![("bad-cmd".into(), config)]).await;

    let err = manager.start_server("bad-cmd").await.unwrap_err();
    assert!(
        matches!(err, McpError::SpawnFailed { ref name, .. } if name == "bad-cmd")
            || matches!(err, McpError::StartupFailed { ref name, .. } if name == "bad-cmd"),
        "expected SpawnFailed or StartupFailed, got: {}",
        err
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_start_empty_command() {
    let config = McpServerConfig::Local {
        command: vec![],
        shell: mcp::ShellType::Auto,
        environment: None,
        enabled: true,
        timeout: Some(5000),
    };
    let manager = common::make_manager(vec![("empty-cmd".into(), config)]).await;

    let err = manager.start_server("empty-cmd").await.unwrap_err();
    assert!(
        matches!(err, McpError::EmptyCommand { ref name } if name == "empty-cmd"),
        "expected EmptyCommand, got: {}",
        err
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_restart_stopped_server() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.restart_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_tools_only_stopped_servers() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    let tools = manager.list_tools().await;
    assert!(
        tools.is_empty(),
        "list_tools should be empty when all servers are stopped"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_call_tool_with_none_args() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let result = manager
        .call_tool("everything", "echo", None)
        .await;

    assert!(
        result.is_err() || result.unwrap().is_error.unwrap_or(true),
        "calling echo with None args should fail (missing required 'message' argument)"
    );

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_server_status_multiple_transitions() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Stopped
    );

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("everything").await.unwrap();
    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Stopped
    );

    manager.restart_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("everything").await.unwrap();
    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Stopped
    );
}

