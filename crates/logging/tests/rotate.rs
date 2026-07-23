use logging::{cleanup_old_logs, timestamp_format, DEFAULT_RETENTION_DAYS};
use chrono::{Local, NaiveDate};
use flexi_logger::{DeferredNow, Record};
use std::fs;
use tempfile::TempDir;

#[test]
fn test_cleanup_old_logs_removes_old_files() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    let old_date = Local::now() - chrono::Duration::days(DEFAULT_RETENTION_DAYS as i64 + 10);
    let old_name = old_date.format("%Y%m%d-000000_000.log").to_string();
    fs::write(dir.join(&old_name), "old log").unwrap();

    let recent_name = Local::now().format("%Y%m%d-120000_000.log").to_string();
    fs::write(dir.join(&recent_name), "recent log").unwrap();

    cleanup_old_logs(dir, DEFAULT_RETENTION_DAYS);

    let remaining: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "log"))
        .collect();

    assert_eq!(remaining.len(), 1, "old log should be deleted");
    assert!(
        remaining[0].path().file_name().unwrap().to_str().unwrap().starts_with(
            &Local::now().format("%Y%m%d").to_string()
        ),
        "remaining file should be the recent one"
    );
}

#[test]
fn test_cleanup_old_logs_preserves_recent_files() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    let recent_name = Local::now().format("%Y%m%d-120000_000.log").to_string();
    fs::write(dir.join(&recent_name), "recent log").unwrap();

    cleanup_old_logs(dir, DEFAULT_RETENTION_DAYS);

    let remaining: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "log"))
        .collect();

    assert_eq!(remaining.len(), 1, "recent log should be preserved");
}

#[test]
fn test_cleanup_old_logs_ignores_non_log_files() {
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path();

    let old_date = Local::now() - chrono::Duration::days(DEFAULT_RETENTION_DAYS as i64 + 10);
    let old_name = old_date.format("%Y%m%d-000000_000.txt").to_string();
    fs::write(dir.join(&old_name), "not a log").unwrap();

    cleanup_old_logs(dir, DEFAULT_RETENTION_DAYS);

    let remaining: Vec<_> = fs::read_dir(dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .collect();

    assert_eq!(remaining.len(), 1, "non-log files should be preserved");
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
