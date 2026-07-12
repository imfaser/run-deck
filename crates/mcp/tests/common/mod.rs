#![allow(dead_code)]

use std::collections::HashMap;
use std::time::Duration;

use mcp::{McpManager, McpServerConfig, ShellType, ServerStatus};

pub const TIMEOUT: Option<u64> = Some(90_000);

pub fn local_everything_config() -> McpServerConfig {
    McpServerConfig::Local {
        command: vec![
            "npx".into(),
            "-y".into(),
            "@modelcontextprotocol/server-everything".into(),
        ],
        environment: None,
        enabled: true,
        timeout: TIMEOUT,
    }
}

pub fn local_git_config() -> McpServerConfig {
    McpServerConfig::Local {
        command: vec!["uvx".into(), "mcp-server-git".into()],
        environment: None,
        enabled: true,
        timeout: TIMEOUT,
    }
}

pub fn remote_config() -> McpServerConfig {
    McpServerConfig::Remote {
        url: "http://192.168.16.24:6005/mcp".into(),
        headers: None,
        enabled: true,
        timeout: TIMEOUT,
    }
}

pub async fn wait_for_running(manager: &McpManager, name: &str) {
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

pub async fn make_manager(configs: Vec<(String, McpServerConfig)>) -> McpManager {
    let map: HashMap<String, McpServerConfig> = configs.into_iter().collect();
    McpManager::new(map, ShellType::Auto)
}
