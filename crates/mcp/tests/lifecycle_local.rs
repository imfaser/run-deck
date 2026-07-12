mod common;

use mcp::{McpEvent, ServerStatus};
use std::time::Duration;

#[tokio::test(flavor = "multi_thread")]
async fn test_start_local_server() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    let mut rx = manager.subscribe();
    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Running
    );

    let event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(event, McpEvent::ServerReady { name } if name == "everything"));

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_stop_local_server() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let mut rx = manager.subscribe();
    manager.stop_server("everything").await.unwrap();

    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Stopped
    );

    let event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(event, McpEvent::ServerStopped { name } if name == "everything"));
}

#[tokio::test(flavor = "multi_thread")]
async fn test_restart_local_server() {
    let manager =
        common::make_manager(vec![("everything".into(), common::local_everything_config())]).await;

    manager.start_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    let mut rx = manager.subscribe();
    manager.restart_server("everything").await.unwrap();
    common::wait_for_running(&manager, "everything").await;

    assert_eq!(
        manager.server_status("everything").await.unwrap(),
        ServerStatus::Running
    );

    let stop_event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(stop_event, McpEvent::ServerStopped { name } if name == "everything"));

    let start_event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(matches!(start_event, McpEvent::ServerReady { name } if name == "everything"));

    manager.stop_server("everything").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_status_local_server() {
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
}
