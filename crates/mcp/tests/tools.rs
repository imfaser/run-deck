mod common;

#[tokio::test(flavor = "multi_thread")]
async fn test_list_tools_local() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let tools = manager.list_tools().await;
    assert!(!tools.is_empty());

    let echo = tools.iter().find(|t| t.tool.name == "echo");
    assert!(echo.is_some(), "echo tool should be present");
    assert_eq!(echo.unwrap().server_name, "everything");

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_call_tool_echo() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let result = manager
        .call_tool(
            "everything",
            "echo",
            Some(serde_json::json!({"message": "hello"})),
        )
        .await
        .unwrap();

    assert!(!result.is_error.unwrap_or(false));
    let content_str = format!("{:?}", result.content);
    assert!(
        content_str.contains("hello"),
        "result should contain 'hello'"
    );

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_tools_remote() {
    let manager =
        common::make_manager(vec![("web-search".into(), common::remote_config())]).await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    let tools = manager.list_tools().await;
    assert!(!tools.is_empty(), "remote server should expose at least one tool");
    assert!(tools.iter().all(|t| t.server_name == "web-search"));

    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_call_tool_remote() {
    let manager =
        common::make_manager(vec![("web-search".into(), common::remote_config())]).await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    let tools = manager.list_tools().await;
    let first_tool = &tools[0];
    let tool_name = first_tool.tool.name.clone();

    let result = manager
        .call_tool("web-search", &tool_name, Some(serde_json::json!({"query": "test"})))
        .await;

    assert!(result.is_ok(), "call_tool should succeed: {:?}", result.err());

    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_tools_aggregates() {
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

    let everything_tools: Vec<_> = tools.iter().filter(|t| t.server_name == "everything").collect();
    let web_search_tools: Vec<_> = tools.iter().filter(|t| t.server_name == "web-search").collect();

    assert!(!everything_tools.is_empty(), "should have tools from everything");
    assert!(!web_search_tools.is_empty(), "should have tools from web-search");

    manager.stop_server("everything").await.unwrap();
    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_call_tool_routes_correctly() {
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
            Some(serde_json::json!({"message": "route-test"})),
        )
        .await
        .unwrap();
    assert!(!echo_result.is_error.unwrap_or(false));

    let tools = manager.list_tools().await;
    let remote_tool = tools.iter().find(|t| t.server_name == "web-search").unwrap();
    let remote_name = remote_tool.tool.name.clone();

    let search_result = manager
        .call_tool("web-search", &remote_name, Some(serde_json::json!({"query": "test"})))
        .await;
    assert!(search_result.is_ok());

    manager.stop_server("everything").await.unwrap();
    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_server_info() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let info = manager.server_info("everything").await.unwrap();
    assert!(info.is_some(), "server_info should return Some after start");

    let info = info.unwrap();
    assert!(!info.name.is_empty(), "server name should not be empty");
    assert!(!info.version.is_empty(), "server version should not be empty");
    assert!(info.has_tools, "everything server should support tools");

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_server_info_not_running() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    // Don't start the server
    let info = manager.server_info("everything").await.unwrap();
    assert!(info.is_none(), "server_info should return None when not running");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_server_info_not_found() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    let result = manager.server_info("nonexistent").await;
    assert!(result.is_err(), "server_info should return Err for nonexistent server");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_prompts() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let prompts = manager.list_prompts().await;
    // everything server provides prompts
    assert!(!prompts.is_empty(), "everything server should have prompts");

    for prompt in &prompts {
        assert_eq!(prompt.server_name, "everything");
        assert!(!prompt.prompt.name.is_empty(), "prompt name should not be empty");
    }

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_prompts_empty_when_no_prompts() {
    // web-search server may not have prompts
    let manager =
        common::make_manager(vec![("web-search".into(), common::remote_config())]).await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    let prompts = manager.list_prompts().await;
    // Just verify it doesn't panic - result may be empty or not depending on server
    let _ = prompts;

    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_resources() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let resources = manager.list_resources().await;
    // everything server provides resources
    assert!(!resources.is_empty(), "everything server should have resources");

    for resource in &resources {
        assert_eq!(resource.server_name, "everything");
        assert!(!resource.resource.uri.is_empty(), "resource URI should not be empty");
        assert!(!resource.resource.name.is_empty(), "resource name should not be empty");
    }

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_resources_empty_when_no_resources() {
    // web-search server may not have resources
    let manager =
        common::make_manager(vec![("web-search".into(), common::remote_config())]).await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    let resources = manager.list_resources().await;
    // Just verify it doesn't panic - result may be empty or not depending on server
    let _ = resources;

    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_prompts_not_running() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    // Don't start - should return empty since only running servers are queried
    let prompts = manager.list_prompts().await;
    assert!(prompts.is_empty(), "should return empty when server not running");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_list_resources_not_running() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    // Don't start - should return empty since only running servers are queried
    let resources = manager.list_resources().await;
    assert!(resources.is_empty(), "should return empty when server not running");
}

#[tokio::test(flavor = "multi_thread")]
async fn test_server_info_after_stop() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    // Should have info when running
    let info = manager.server_info("everything").await.unwrap();
    assert!(info.is_some(), "should have info when running");

    manager.stop_server("everything").await.unwrap();

    // Should have no info after stop
    let info = manager.server_info("everything").await.unwrap();
    assert!(info.is_none(), "should have no info after stop");
}
