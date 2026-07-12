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
