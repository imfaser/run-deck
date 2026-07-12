mod common;

use std::process::Command as StdCommand;

#[tokio::test(flavor = "multi_thread")]
async fn test_git_server_list_tools() {
    let tmp = tempfile::tempdir().unwrap();
    StdCommand::new("git")
        .args(["init"])
        .current_dir(tmp.path())
        .output()
        .unwrap();

    let manager =
        common::make_manager(vec![("git".into(), common::local_git_config())]).await;

    manager.start_server("git").await.unwrap();
    common::wait_for_running(&manager, "git").await;

    let tools = manager.list_tools().await;
    assert!(!tools.is_empty(), "git server should expose tools");

    let has_git_tool = tools.iter().any(|t| t.tool.name.contains("git"));
    assert!(has_git_tool, "should have at least one git-prefixed tool");

    manager.stop_server("git").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_git_status_clean() {
    let tmp = tempfile::tempdir().unwrap();
    StdCommand::new("git")
        .args(["init"])
        .current_dir(tmp.path())
        .output()
        .unwrap();

    let manager =
        common::make_manager(vec![("git".into(), common::local_git_config())]).await;

    manager.start_server("git").await.unwrap();
    common::wait_for_running(&manager, "git").await;

    let repo_path = tmp.path().to_string_lossy().to_string();
    let result = manager
        .call_tool(
            "git",
            "git_status",
            Some(serde_json::json!({"repo_path": repo_path})),
        )
        .await
        .unwrap();

    assert!(!result.is_error.unwrap_or(false));

    manager.stop_server("git").await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_git_status_with_changes() {
    let tmp = tempfile::tempdir().unwrap();
    StdCommand::new("git")
        .args(["init"])
        .current_dir(tmp.path())
        .output()
        .unwrap();

    std::fs::write(tmp.path().join("new_file.txt"), "some content").unwrap();

    let manager =
        common::make_manager(vec![("git".into(), common::local_git_config())]).await;

    manager.start_server("git").await.unwrap();
    common::wait_for_running(&manager, "git").await;

    let repo_path = tmp.path().to_string_lossy().to_string();
    let result = manager
        .call_tool(
            "git",
            "git_status",
            Some(serde_json::json!({"repo_path": repo_path})),
        )
        .await
        .unwrap();

    assert!(!result.is_error.unwrap_or(false));

    let content_str = format!("{:?}", result.content);
    assert!(
        content_str.contains("new_file") || content_str.contains("Untracked"),
        "status should mention the new file: {}",
        content_str
    );

    manager.stop_server("git").await.unwrap();
}
