mod common;

use mcp::{McpManager, McpServerConfig, ShellType, ServerStatus};
use std::collections::HashMap;
use std::time::Duration;

fn local_everything_config() -> McpServerConfig {
    McpServerConfig::Local {
        command: vec![
            "npx".into(),
            "-y".into(),
            "@modelcontextprotocol/server-everything".into(),
        ],
        environment: None,
        enabled: true,
        timeout: common::TIMEOUT,
    }
}

async fn wait_for_running(manager: &McpManager, name: &str) {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(90);
    loop {
        if tokio::time::Instant::now() >= deadline {
            panic!(
                "timeout waiting for server '{}' to reach Running state",
                name
            );
        }
        match manager.server_status(name).await {
            Ok(ServerStatus::Running) => return,
            Ok(ServerStatus::Failed { error }) => {
                panic!("server '{}' entered Failed state: {}", name, error);
            }
            _ => {}
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

/// 测试 Auto (Windows 默认 Cmd) 启动 MCP 服务器
#[tokio::test(flavor = "multi_thread")]
async fn test_start_with_auto_shell() {
    let config = local_everything_config();
    let manager = common::make_manager(vec![("auto-srv".into(), config)]).await;

    manager.start_server("auto-srv").await.unwrap();
    wait_for_running(&manager, "auto-srv").await;

    assert_eq!(
        manager.server_status("auto-srv").await.unwrap(),
        ServerStatus::Running
    );

    let tools = manager.list_tools().await;
    assert!(!tools.is_empty(), "should discover tools with Auto shell");

    manager.stop_server("auto-srv").await.unwrap();
}

/// 测试 Cmd 启动 MCP 服务器
#[tokio::test(flavor = "multi_thread")]
async fn test_start_with_cmd_shell() {
    let config = local_everything_config();
    let manager = McpManager::new(
        HashMap::from([("cmd-srv".into(), config)]),
        ShellType::Cmd,
    );

    manager.start_server("cmd-srv").await.unwrap();
    wait_for_running(&manager, "cmd-srv").await;

    assert_eq!(
        manager.server_status("cmd-srv").await.unwrap(),
        ServerStatus::Running
    );

    let tools = manager.list_tools().await;
    assert!(!tools.is_empty(), "should discover tools with Cmd shell");

    manager.stop_server("cmd-srv").await.unwrap();
}

/// 测试 PowerShell 启动 MCP 服务器
#[tokio::test(flavor = "multi_thread")]
async fn test_start_with_powershell_shell() {
    let config = local_everything_config();
    let manager = McpManager::new(
        HashMap::from([("ps-srv".into(), config)]),
        ShellType::PowerShell,
    );

    manager.start_server("ps-srv").await.unwrap();
    wait_for_running(&manager, "ps-srv").await;

    assert_eq!(
        manager.server_status("ps-srv").await.unwrap(),
        ServerStatus::Running
    );

    let tools = manager.list_tools().await;
    assert!(
        !tools.is_empty(),
        "should discover tools with PowerShell shell"
    );

    manager.stop_server("ps-srv").await.unwrap();
}

/// 测试 PowerShell 调用工具
#[tokio::test(flavor = "multi_thread")]
async fn test_call_tool_with_powershell() {
    let config = local_everything_config();
    let manager = McpManager::new(
        HashMap::from([("ps-srv".into(), config)]),
        ShellType::PowerShell,
    );

    manager.start_server("ps-srv").await.unwrap();
    wait_for_running(&manager, "ps-srv").await;

    let result = manager
        .call_tool(
            "ps-srv",
            "echo",
            Some(serde_json::json!({"message": "powershell-test"})),
        )
        .await
        .unwrap();

    assert!(!result.is_error.unwrap_or(false));
    let content_str = format!("{:?}", result.content);
    assert!(
        content_str.contains("powershell-test"),
        "PowerShell tool call should work, got: {content_str}"
    );

    manager.stop_server("ps-srv").await.unwrap();
}

/// 测试 PowerShell 带环境变量启动
#[tokio::test(flavor = "multi_thread")]
async fn test_start_with_powershell_and_env() {
    let config = McpServerConfig::Local {
        command: vec![
            "npx".into(),
            "-y".into(),
            "@modelcontextprotocol/server-everything".into(),
        ],
        environment: Some(HashMap::from([(
            "NODE_ENV".to_string(),
            "test".to_string(),
        )])),
        enabled: true,
        timeout: common::TIMEOUT,
    };
    let manager = McpManager::new(
        HashMap::from([("ps-env-srv".into(), config)]),
        ShellType::PowerShell,
    );

    manager.start_server("ps-env-srv").await.unwrap();
    wait_for_running(&manager, "ps-env-srv").await;

    assert_eq!(
        manager.server_status("ps-env-srv").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("ps-env-srv").await.unwrap();
}

/// 测试不同 shell 启动后工具列表一致
#[tokio::test(flavor = "multi_thread")]
async fn test_tools_consistent_across_shells() {
    let auto_config = local_everything_config();
    let cmd_config = local_everything_config();
    let ps_config = local_everything_config();

    let manager = common::make_manager(vec![
        ("auto-srv".into(), auto_config),
        ("cmd-srv".into(), cmd_config),
        ("ps-srv".into(), ps_config),
    ])
    .await;

    manager.start_server("auto-srv").await.unwrap();
    manager.start_server("cmd-srv").await.unwrap();
    manager.start_server("ps-srv").await.unwrap();

    wait_for_running(&manager, "auto-srv").await;
    wait_for_running(&manager, "cmd-srv").await;
    wait_for_running(&manager, "ps-srv").await;

    let all_tools = manager.list_tools().await;

    let auto_tools: Vec<_> = all_tools
        .iter()
        .filter(|t| t.server_name == "auto-srv")
        .collect();
    let cmd_tools: Vec<_> = all_tools
        .iter()
        .filter(|t| t.server_name == "cmd-srv")
        .collect();
    let ps_tools: Vec<_> = all_tools
        .iter()
        .filter(|t| t.server_name == "ps-srv")
        .collect();

    assert_eq!(
        auto_tools.len(),
        cmd_tools.len(),
        "Auto and Cmd should discover same number of tools"
    );
    assert_eq!(
        cmd_tools.len(),
        ps_tools.len(),
        "Cmd and PowerShell should discover same number of tools"
    );

    manager.stop_server("auto-srv").await.unwrap();
    manager.stop_server("cmd-srv").await.unwrap();
    manager.stop_server("ps-srv").await.unwrap();
}
