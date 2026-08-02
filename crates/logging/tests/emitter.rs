use logging::{
    set_emitter_enabled, set_log_emitter, setup_log, DEFAULT_LOG_MAX_SIZE_MB,
    DEFAULT_RETENTION_DAYS, KEEP_LOG_FILES,
};
use std::sync::{Arc, Mutex};

type Emitted = (String, String, String);

/// 单一测试：LOG_EMITTER 是进程级 OnceLock 单例，本二进制只注入一次。
/// setup_log 安装 ModuleFilter（emitter 在此 filter 内触发），开关控制是否 emit。
#[test]
fn test_emitter_fires_when_enabled_and_silent_when_disabled() {
    let captured: Arc<Mutex<Vec<Emitted>>> = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::clone(&captured);

    set_log_emitter(Box::new(move |ts, level, message| {
        sink.lock()
            .unwrap()
            .push((ts.to_string(), level.to_string(), message.to_string()));
    }))
    .expect("first set_log_emitter should succeed");

    // 重复注入必须报错（保持原回调不变）
    assert!(
        set_log_emitter(Box::new(|_, _, _| {})).is_err(),
        "second set_log_emitter should fail"
    );

    setup_log(
        None,
        "info",
        DEFAULT_RETENTION_DAYS,
        DEFAULT_LOG_MAX_SIZE_MB,
        KEEP_LOG_FILES,
    );

    // 默认关闭：不 emit
    log::info!(target: "app", "message before enable");

    // 开启：emit（Direct 写模式同步，无需等待）
    set_emitter_enabled(true);
    log::warn!(target: "app", "emitted warning");

    {
        let guard = captured.lock().unwrap();
        assert!(
            guard
                .iter()
                .any(|(_, level, msg)| level == "warn" && msg.contains("emitted warning")),
            "emitter should receive warn record, got {guard:?}"
        );
        // 级别已小写化、时间戳形如 2026-01-01 00:00:00.000
        let (ts, _, _) = guard
            .iter()
            .find(|(_, level, _)| level == "warn")
            .expect("warn record should exist");
        assert_eq!(ts.len(), 23, "timestamp should be %Y-%m-%d %H:%M:%S%.3f, got {ts}");
    }

    // 关闭：不再 emit（记录仍写文件/stdout，但这里只验证不触发回调）
    set_emitter_enabled(false);
    log::error!(target: "app", "message after disable");

    let guard = captured.lock().unwrap();
    assert!(
        !guard
            .iter()
            .any(|(_, _, msg)| msg.contains("message after disable")),
        "emitter should NOT receive record after disable, got {guard:?}"
    );
}
