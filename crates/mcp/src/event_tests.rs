#[cfg(test)]
mod tests {
    use crate::{McpEvent, ServerStatus};

    #[test]
    fn test_event_server_name() {
        let event = McpEvent::ServerStarting {
            name: "test-server".to_string(),
        };
        assert_eq!(event.server_name(), "test-server");

        let event = McpEvent::ServerReady {
            name: "test-server".to_string(),
        };
        assert_eq!(event.server_name(), "test-server");

        let event = McpEvent::ServerFailed {
            name: "test-server".to_string(),
            error: "connection failed".to_string(),
        };
        assert_eq!(event.server_name(), "test-server");

        let event = McpEvent::ServerStopped {
            name: "test-server".to_string(),
        };
        assert_eq!(event.server_name(), "test-server");
    }

    #[test]
    fn test_server_status_equality() {
        assert_eq!(ServerStatus::Starting, ServerStatus::Starting);
        assert_eq!(ServerStatus::Running, ServerStatus::Running);
        assert_eq!(ServerStatus::Stopped, ServerStatus::Stopped);
        assert_eq!(
            ServerStatus::Failed {
                error: "test".to_string()
            },
            ServerStatus::Failed {
                error: "test".to_string()
            }
        );
    }

    #[test]
    fn test_server_status_inequality() {
        assert_ne!(ServerStatus::Starting, ServerStatus::Running);
        assert_ne!(ServerStatus::Running, ServerStatus::Stopped);
        assert_ne!(
            ServerStatus::Failed {
                error: "test1".to_string()
            },
            ServerStatus::Failed {
                error: "test2".to_string()
            }
        );
    }

    #[test]
    fn test_event_clone() {
        let event = McpEvent::ServerStarting {
            name: "test".to_string(),
        };
        let cloned = event.clone();
        assert_eq!(event.server_name(), cloned.server_name());
    }

    #[test]
    fn test_server_status_clone() {
        let status = ServerStatus::Running;
        let cloned = status.clone();
        assert_eq!(status, cloned);
    }
}
