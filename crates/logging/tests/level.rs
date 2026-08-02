use logging::{normalize_log_level, update_log_level};

#[test]
fn test_normalize_log_level_accepts_valid() {
    for level in ["error", "warn", "info", "debug", "trace"] {
        assert_eq!(normalize_log_level(level), level, "should pass through {level}");
    }
}

#[test]
fn test_normalize_log_level_falls_back_to_info() {
    assert_eq!(normalize_log_level("verbose"), "info");
    assert_eq!(normalize_log_level(""), "info");
    assert_eq!(normalize_log_level("INFO"), "info");
}

#[test]
fn test_update_log_level_rejects_invalid() {
    // 无效级别在访问 LOGGER_HANDLE 前即返回错误，无需初始化 logger
    assert!(update_log_level("verbose").is_err());
    assert!(update_log_level("info-ish").is_err());
}

#[test]
fn test_update_log_level_errors_before_setup() {
    // 本二进制未调用 setup_log → LOGGER_HANDLE 未设置 → 有效级别也应报错
    assert!(update_log_level("debug").is_err());
}
