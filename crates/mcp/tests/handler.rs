#![allow(deprecated)]

use mcp::handler::{McpLogEvent, McpLogLevel};
use rmcp::handler::client::progress::ProgressDispatcher;
use rmcp::model::{LoggingLevel, NumberOrString, ProgressToken};
use rmcp::model::ProgressNotificationParam;
use tokio::sync::broadcast;

fn make_progress_params(token: &str, progress: f64, total: Option<f64>) -> ProgressNotificationParam {
    let mut params = ProgressNotificationParam::new(
        ProgressToken(NumberOrString::String(token.into())),
        progress,
    );
    params.total = total;
    params
}

#[tokio::test]
async fn test_progress_subscriber_receives_notification() {
    let dispatcher = ProgressDispatcher::new();
    let token = ProgressToken(NumberOrString::String("test-token".into()));

    let mut subscriber = dispatcher.subscribe(token.clone()).await;

    let params = make_progress_params("test-token", 5.0, Some(10.0));
    dispatcher.handle_notification(params).await;

    let received = tokio::time::timeout(
        std::time::Duration::from_secs(1),
        tokio_stream::StreamExt::next(&mut subscriber),
    )
    .await
    .expect("timeout waiting for progress")
    .expect("stream ended");

    assert_eq!(received.progress, 5.0);
    assert_eq!(received.total, Some(10.0));
    assert_eq!(received.progress_token, token);
}

#[tokio::test]
async fn test_log_broadcast_receiver_receives_event() {
    let (log_tx, mut log_rx) = broadcast::channel::<McpLogEvent>(16);

    let event = McpLogEvent {
        level: McpLogLevel::Info,
        logger: Some("test".into()),
        data: serde_json::json!({"message": "hello"}),
    };
    log_tx.send(event).unwrap();

    let received = tokio::time::timeout(
        std::time::Duration::from_secs(1),
        log_rx.recv(),
    )
    .await
    .expect("timeout waiting for log")
    .expect("channel closed");

    assert!(matches!(received.level, McpLogLevel::Info));
    assert_eq!(received.logger, Some("test".into()));
    assert_eq!(received.data, serde_json::json!({"message": "hello"}));
}

#[tokio::test]
async fn test_progress_no_subscriber_does_not_panic() {
    let dispatcher = ProgressDispatcher::new();
    let params = make_progress_params("no-subscriber", 1.0, None);
    dispatcher.handle_notification(params).await;
}

#[tokio::test]
async fn test_log_no_receiver_does_not_panic() {
    let (log_tx, log_rx) = broadcast::channel::<McpLogEvent>(16);
    drop(log_rx);

    let event = McpLogEvent {
        level: McpLogLevel::Debug,
        logger: None,
        data: serde_json::json!(null),
    };
    let result = log_tx.send(event);
    assert!(result.is_err(), "expected SendError when no receivers");
}

#[tokio::test]
async fn test_progress_subscriber_drop_cleans_up() {
    let dispatcher = ProgressDispatcher::new();
    let token = ProgressToken(NumberOrString::String("cleanup-test".into()));

    let subscriber = dispatcher.subscribe(token.clone()).await;
    drop(subscriber);

    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    let params = make_progress_params("cleanup-test", 99.0, None);
    dispatcher.handle_notification(params).await;
}

#[tokio::test]
async fn test_log_levels_map_correctly() {
    let cases = vec![
        (LoggingLevel::Debug, McpLogLevel::Debug),
        (LoggingLevel::Info, McpLogLevel::Info),
        (LoggingLevel::Notice, McpLogLevel::Notice),
        (LoggingLevel::Warning, McpLogLevel::Warning),
        (LoggingLevel::Error, McpLogLevel::Error),
        (LoggingLevel::Critical, McpLogLevel::Critical),
        (LoggingLevel::Alert, McpLogLevel::Alert),
        (LoggingLevel::Emergency, McpLogLevel::Emergency),
    ];

    for (rmcp_level, expected) in cases {
        let actual: McpLogLevel = rmcp_level.into();
        assert!(
            std::mem::discriminant(&actual) == std::mem::discriminant(&expected),
            "level mismatch"
        );
    }
}
