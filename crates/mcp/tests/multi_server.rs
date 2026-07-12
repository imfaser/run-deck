mod common;

use mcp::ServerStatus;

#[tokio::test(flavor = "multi_thread")]
async fn test_start_multiple_servers() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    manager.start_server("everything").await.unwrap();
    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    common::wait_for_running(&manager, "web-search").await;

    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Running
    );
    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("everything").await.unwrap();
    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_stop_one_others_keep_running() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    manager.start_server("everything").await.unwrap();
    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    common::wait_for_running(&manager, "web-search").await;

    manager.stop_server("everything").await.unwrap();

    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Stopped
    );
    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_restart_one_others_keep_running() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    manager.start_server("everything").await.unwrap();
    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    common::wait_for_running(&manager, "web-search").await;

    manager.restart_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Running
    );
    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("everything").await.unwrap();
    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_tools_across_multiple_servers() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    manager.start_server("everything").await.unwrap();
    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    common::wait_for_running(&manager, "web-search").await;

    let tools = manager.list_tools().await;

    let everything_tools: Vec<_> = tools
        .iter()
        .filter(|t| t.server_name == "everything")
        .collect();
    let web_search_tools: Vec<_> = tools
        .iter()
        .filter(|t| t.server_name == "web-search")
        .collect();

    assert!(
        !everything_tools.is_empty(),
        "should have tools from everything"
    );
    assert!(
        !web_search_tools.is_empty(),
        "should have tools from web-search"
    );

    let echo = everything_tools.iter().find(|t| t.tool.name == "echo");
    assert!(echo.is_some(), "everything should expose echo tool");

    manager.stop_server("everything").await.unwrap();
    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_tools_only_from_running_servers() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    manager.start_server("everything").await.unwrap();
    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    common::wait_for_running(&manager, "web-search").await;

    manager.stop_server("everything").await.unwrap();

    let tools = manager.list_tools().await;

    assert!(
        tools.iter().all(|t| t.server_name == "web-search"),
        "should only have tools from web-search after stopping everything"
    );
    assert!(!tools.is_empty(), "web-search tools should still be present");

    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_call_tool_on_each_server() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    manager.start_server("everything").await.unwrap();
    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    common::wait_for_running(&manager, "web-search").await;

    let echo_result = manager
        .call_tool(
            "everything",
            "echo",
            Some(serde_json::json!({"message": "multi-test"})),
        )
        .await
        .unwrap();
    assert!(!echo_result.is_error.unwrap_or(false));

    let tools = manager.list_tools().await;
    let remote_tool_name = tools
        .iter()
        .find(|t| t.server_name == "web-search")
        .unwrap()
        .tool
        .name
        .clone();

    let search_result = manager
        .call_tool(
            "web-search",
            &remote_tool_name,
            Some(serde_json::json!({"query": "test"})),
        )
        .await;
    assert!(search_result.is_ok());

    manager.stop_server("everything").await.unwrap();
    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_events_from_multiple_servers() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    let mut rx = manager.subscribe();

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    let event1 = tokio::time::timeout(std::time::Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(event1, mcp::McpEvent::ServerReady { name } if name == "everything"));

    let event2 = tokio::time::timeout(std::time::Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(event2, mcp::McpEvent::ServerReady { name } if name == "web-search"));

    manager.stop_server("everything").await.unwrap();
    let event3 = tokio::time::timeout(std::time::Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(event3, mcp::McpEvent::ServerStopped { name } if name == "everything"));

    manager.stop_server("web-search").await.unwrap();
    let event4 = tokio::time::timeout(std::time::Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(event4, mcp::McpEvent::ServerStopped { name } if name == "web-search"));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_start_stop_restart_interleaved() {
    let manager = common::make_manager(vec![
        ("everything".into(), common::local_everything_config()),
        ("web-search".into(), common::remote_config()),
    ])
    .await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    manager.stop_server("everything").await.unwrap();
    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Stopped
    );
    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.restart_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;
    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;
    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Running
    );
    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("everything").await.unwrap();
    manager.stop_server("web-search").await.unwrap();
}
