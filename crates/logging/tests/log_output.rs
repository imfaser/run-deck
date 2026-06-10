use logging::setup_log;
use std::fs;
use tempfile::TempDir;

#[test]
fn test_log_file_created() {
    let tmp = TempDir::new().unwrap();
    let log_dir = tmp.path().join("logs");

    setup_log(Some(&log_dir));

    log::info!(target: "app", "test message from setup");

    let entries: Vec<_> = fs::read_dir(&log_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "log"))
        .collect();

    assert!(!entries.is_empty(), "expected at least one .log file");

    let content = fs::read_to_string(entries[0].path()).unwrap();
    assert!(content.contains("test message from setup"), "log file content: {content}");
    assert!(content.contains("INFO"), "expected level INFO in: {content}");
}
