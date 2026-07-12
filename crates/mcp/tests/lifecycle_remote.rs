mod common;

use mcp::ServerStatus;

#[tokio::test(flavor = "multi_thread")]
async fn test_start_remote_server() {
    let manager =
        common::make_manager(vec![("web-search".into(), common::remote_config())]).await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_stop_remote_server() {
    let manager =
        common::make_manager(vec![("web-search".into(), common::remote_config())]).await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    manager.stop_server("web-search").await.unwrap();

    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Stopped
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn test_restart_remote_server() {
    let manager =
        common::make_manager(vec![("web-search".into(), common::remote_config())]).await;

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    manager.restart_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;

    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("web-search").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_status_remote_server() {
    let manager =
        common::make_manager(vec![("web-search".into(), common::remote_config())]).await;

    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Stopped
    );

    manager.start_server("web-search").await.unwrap();
    common::wait_for_running(&manager, "web-search").await;
    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Running
    );

    manager.stop_server("web-search").await.unwrap();
    assert_eq!(
        manager.server_status("web-search").await.unwrap(),
        ServerStatus::Stopped
    );
}
