use logging::{KEEP_LOG_FILES, rotate_logs, timestamp_format};
use flexi_logger::{DeferredNow, Record};
use std::fs;
use tempfile::TempDir;

#[test]
fn test_rotate_logs() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    for i in 0..7 {
        let name = format!("{:04}-01-01_00-00-0{:02}.log", 2020 + i, i);
        fs::write(dir.join(&name), format!("log content {i}")).unwrap();
    }

    rotate_logs(dir);

    let remaining: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "log"))
        .collect();

    assert_eq!(remaining.len(), KEEP_LOG_FILES, "should keep {KEEP_LOG_FILES} log files");
    assert!(dir.join("old.tar.gz").exists(), "old.tar.gz should exist");
}

#[test]
fn test_rotate_noop_when_under_limit() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    for i in 0..3 {
        fs::write(dir.join(format!("test_{i}.log")), "content").unwrap();
    }

    rotate_logs(dir);

    let remaining: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .collect();

    assert_eq!(remaining.len(), 3, "should not touch files when under limit");
    assert!(!dir.join("old.tar.gz").exists());
}

#[test]
fn test_timestamp_format_contains_expected_format() {
    let mut buf = Vec::new();
    let now = &mut DeferredNow::new();
    let record = Record::builder()
        .level(log::Level::Info)
        .module_path_static(Some("test::module"))
        .args(format_args!("hello"))
        .build();

    timestamp_format(&mut buf, now, &record).unwrap();
    let output = String::from_utf8(buf).unwrap();

    assert!(output.contains("INFO"), "output: {output}");
    assert!(output.contains("hello"), "output: {output}");
    assert!(output.contains("[test::module]"), "output: {output}");

    let ts_part = &output[..23];
    assert!(
        ts_part.chars().all(|c| c.is_ascii_digit() || c == '-' || c == ' ' || c == ':' || c == '.'),
        "unexpected timestamp format: {ts_part}"
    );
}
