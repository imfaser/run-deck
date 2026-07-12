mod common;

use mcp::ShellType;
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::Command;

#[test]
fn test_config_json_with_env() {
    let json = r#"{
        "type": "local",
        "command": ["npx", "-y", "my-server"],
        "environment": {
            "NODE_ENV": "production",
            "DEBUG": "true"
        },
        "enabled": true
    }"#;

    let config: mcp::McpServerConfig = serde_json::from_str(json).unwrap();

    match config {
        mcp::McpServerConfig::Local {
            environment,
            ..
        } => {
            let env = environment.unwrap();
            assert_eq!(env.get("NODE_ENV").unwrap(), "production");
            assert_eq!(env.get("DEBUG").unwrap(), "true");
        }
        _ => panic!("expected Local config"),
    }
}

#[test]
fn test_config_json_default_values() {
    let json = r#"{
        "type": "local",
        "command": ["npx", "-y", "my-server"],
        "environment": {"VAR": "value"},
        "enabled": true
    }"#;

    let config: mcp::McpServerConfig = serde_json::from_str(json).unwrap();

    match config {
        mcp::McpServerConfig::Local { enabled, .. } => {
            assert!(enabled);
        }
        _ => panic!("expected Local config"),
    }
}

#[test]
fn test_wrap_command_with_env_context() {
    let cmd = vec!["node".to_string(), "server.js".to_string()];

    let cmd_wrapped = mcp::shell::wrap_command(&ShellType::Cmd, &cmd);
    assert_eq!(cmd_wrapped[0], "cmd");
    assert_eq!(cmd_wrapped[1], "/c");

    let ps_wrapped = mcp::shell::wrap_command(&ShellType::PowerShell, &cmd);
    assert_eq!(ps_wrapped[0], "powershell");
    assert_eq!(ps_wrapped[1], "-NoProfile");
    assert_eq!(ps_wrapped[2], "-Command");
    // PowerShell 不需要引号包裹命令

    let bash_wrapped = mcp::shell::wrap_command(&ShellType::Bash, &cmd);
    assert_eq!(bash_wrapped[0], "bash");
    assert_eq!(bash_wrapped[1], "-c");
}

/// 测试 Cmd 环境变量注入
#[tokio::test]
async fn test_cmd_env_injection() {
    let wrapped = mcp::shell::wrap_command(
        &ShellType::Cmd,
        &["echo".to_string(), "%MCP_TEST_VAR%".to_string()],
    );

    let mut cmd = Command::new(&wrapped[0]);
    cmd.args(&wrapped[1..])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .env("MCP_TEST_VAR", "hello_from_cmd");

    let output = cmd.output().await.unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("hello_from_cmd"),
        "Cmd env injection failed, got: {stdout}"
    );
}

/// 测试 PowerShell 环境变量注入
#[tokio::test]
async fn test_powershell_env_injection() {
    let wrapped = mcp::shell::wrap_command(
        &ShellType::PowerShell,
        &["Write-Output".to_string(), "$env:MCP_TEST_VAR".to_string()],
    );

    let mut cmd = Command::new(&wrapped[0]);
    cmd.args(&wrapped[1..])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .env("MCP_TEST_VAR", "hello_from_powershell");

    let output = cmd.output().await.unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("hello_from_powershell"),
        "PowerShell env injection failed, got: {stdout}"
    );
}

/// 测试多个环境变量注入
#[tokio::test]
async fn test_multiple_env_vars_injection() {
    let wrapped = mcp::shell::wrap_command(
        &ShellType::Cmd,
        &[
            "cmd".to_string(),
            "/c".to_string(),
            "echo".to_string(),
            "%VAR1%".to_string(),
            "%VAR2%".to_string(),
        ],
    );

    let mut cmd = Command::new(&wrapped[0]);
    cmd.args(&wrapped[1..])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .env("VAR1", "value1")
        .env("VAR2", "value2");

    let output = cmd.output().await.unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains("value1") && stdout.contains("value2"),
        "Multiple env vars injection failed, got: {stdout}"
    );
}

/// 测试环境变量为空时不注入
#[tokio::test]
async fn test_no_env_vars() {
    let wrapped = mcp::shell::wrap_command(
        &ShellType::Cmd,
        &["echo".to_string(), "no_env".to_string()],
    );

    let mut cmd = Command::new(&wrapped[0]);
    cmd.args(&wrapped[1..])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    // 不调用 .env()

    let output = cmd.output().await.unwrap();
    assert!(output.status.success(), "Command should succeed without env vars");
}
