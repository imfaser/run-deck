#[cfg(test)]
mod tests {
    use crate::McpServerConfig;
    use crate::shell::ShellType;
    use std::collections::HashMap;

    #[test]
    fn test_local_config_enabled_by_default() {
        let config = McpServerConfig::Local {
            command: vec!["echo".to_string()],
            shell: ShellType::Auto,
            environment: None,
            enabled: true,
            timeout: None,
        };
        assert!(config.is_enabled());
    }

    #[test]
    fn test_local_config_disabled() {
        let config = McpServerConfig::Local {
            command: vec!["echo".to_string()],
            shell: ShellType::Auto,
            environment: None,
            enabled: false,
            timeout: None,
        };
        assert!(!config.is_enabled());
    }

    #[test]
    fn test_remote_config_enabled_by_default() {
        let config = McpServerConfig::Remote {
            url: "https://example.com/mcp".to_string(),
            headers: None,
            enabled: true,
            timeout: None,
        };
        assert!(config.is_enabled());
    }

    #[test]
    fn test_remote_config_disabled() {
        let config = McpServerConfig::Remote {
            url: "https://example.com/mcp".to_string(),
            headers: None,
            enabled: false,
            timeout: None,
        };
        assert!(!config.is_enabled());
    }

    #[test]
    fn test_config_timeout() {
        let config = McpServerConfig::Local {
            command: vec!["echo".to_string()],
            shell: ShellType::Auto,
            environment: None,
            enabled: true,
            timeout: Some(5000),
        };
        assert_eq!(config.timeout_ms(), Some(5000));
    }

    #[test]
    fn test_config_no_timeout() {
        let config = McpServerConfig::Local {
            command: vec!["echo".to_string()],
            shell: ShellType::Auto,
            environment: None,
            enabled: true,
            timeout: None,
        };
        assert_eq!(config.timeout_ms(), None);
    }

    #[test]
    fn test_config_with_environment() {
        let mut env = HashMap::new();
        env.insert("KEY".to_string(), "value".to_string());

        let config = McpServerConfig::Local {
            command: vec!["echo".to_string()],
            shell: ShellType::Auto,
            environment: Some(env.clone()),
            enabled: true,
            timeout: None,
        };

        match config {
            McpServerConfig::Local { environment, .. } => {
                assert_eq!(environment, Some(env));
            }
            _ => panic!("expected Local config"),
        }
    }

    #[test]
    fn test_config_serialization_roundtrip() {
        let config = McpServerConfig::Local {
            command: vec!["npx".to_string(), "-y".to_string(), "my-mcp-server".to_string()],
            shell: ShellType::Auto,
            environment: Some(HashMap::from([("KEY".to_string(), "value".to_string())])),
            enabled: true,
            timeout: Some(5000),
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: McpServerConfig = serde_json::from_str(&json).unwrap();

        match (&config, &deserialized) {
            (
                McpServerConfig::Local {
                    command: cmd1,
                    enabled: e1,
                    timeout: t1,
                    ..
                },
                McpServerConfig::Local {
                    command: cmd2,
                    enabled: e2,
                    timeout: t2,
                    ..
                },
            ) => {
                assert_eq!(cmd1, cmd2);
                assert_eq!(e1, e2);
                assert_eq!(t1, t2);
            }
            _ => panic!("config type mismatch"),
        }
    }

    #[test]
    fn test_config_json_deserialization() {
        let json = r#"{
            "type": "local",
            "command": ["npx", "-y", "my-mcp-server"],
            "enabled": true,
            "timeout": 5000,
            "environment": {
                "MY_VAR": "my_value"
            }
        }"#;

        let config: McpServerConfig = serde_json::from_str(json).unwrap();
        assert!(config.is_enabled());
        assert_eq!(config.timeout_ms(), Some(5000));

        match config {
            McpServerConfig::Local {
                command,
                environment,
                ..
            } => {
                assert_eq!(command, vec!["npx", "-y", "my-mcp-server"]);
                assert!(environment.is_some());
                let env = environment.unwrap();
                assert_eq!(env.get("MY_VAR").unwrap(), "my_value");
            }
            _ => panic!("expected Local config"),
        }
    }

    #[test]
    fn test_remote_config_json_deserialization() {
        let json = r#"{
            "type": "remote",
            "url": "https://example.com/mcp",
            "enabled": true,
            "headers": {
                "Authorization": "Bearer token123"
            }
        }"#;

        let config: McpServerConfig = serde_json::from_str(json).unwrap();
        assert!(config.is_enabled());

        match config {
            McpServerConfig::Remote {
                url, headers, ..
            } => {
                assert_eq!(url, "https://example.com/mcp");
                assert!(headers.is_some());
                let h = headers.unwrap();
                assert_eq!(h.get("Authorization").unwrap(), "Bearer token123");
            }
            _ => panic!("expected Remote config"),
        }
    }
}
