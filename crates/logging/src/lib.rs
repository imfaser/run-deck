use chrono::Local;
use flexi_logger::{DeferredNow, FileSpec, LogSpecification, Logger, LoggerHandle, Record, WriteMode};
use std::fmt;
use std::fs;
use std::panic::PanicHookInfo;
use std::path::Path;
use std::sync::OnceLock;

pub const KEEP_LOG_FILES: usize = 8;
pub const DEFAULT_LOG_MAX_SIZE_MB: u64 = 1;
pub const DEFAULT_RETENTION_DAYS: u32 = 30;

static LOGGER_HANDLE: OnceLock<LoggerHandle> = OnceLock::new();

#[derive(Debug, PartialEq, Eq)]
pub enum Type {
    Cmd,
    Setup,
    System,
    Config,
    Frontend,
    File,
    Mcp,
    Window,
    Update,
    Network,
    Tray,
}

impl fmt::Display for Type {
    #[inline]
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Cmd => write!(f, "[Cmd]"),
            Self::Setup => write!(f, "[Setup]"),
            Self::System => write!(f, "[System]"),
            Self::Config => write!(f, "[Config]"),
            Self::Frontend => write!(f, "[Frontend]"),
            Self::File => write!(f, "[File]"),
            Self::Mcp => write!(f, "[Mcp]"),
            Self::Window => write!(f, "[Window]"),
            Self::Update => write!(f, "[Update]"),
            Self::Network => write!(f, "[Network]"),
            Self::Tray => write!(f, "[Tray]"),
        }
    }
}

#[macro_export]
macro_rules! logging {
    ($level:ident, $type:expr, $($arg:tt)*) => {
        log::$level!(target: "app", "{} {}", $type, format_args!($($arg)*))
    };
}

#[macro_export]
macro_rules! logging_error {
    ($type:expr, $expr:expr) => {
        if let Err(err) = $expr {
            log::error!(target: "app", "{} {}", $type, err);
        }
    };
    ($type:expr, $fmt:literal $(, $arg:expr)*) => {
        log::error!(target: "app", "{} {}", $type, format_args!($fmt $(, $arg)*));
    };
}

pub fn timestamp_format(w: &mut dyn std::io::Write, _now: &mut DeferredNow, record: &Record) -> Result<(), std::io::Error> {
    write!(
        w,
        "{} {:<5} [{}] {}",
        Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
        record.level(),
        record.module_path_static().unwrap_or_default(),
        record.args()
    )
}

fn colored_timestamp_format(
    w: &mut dyn std::io::Write,
    _now: &mut DeferredNow,
    record: &Record,
) -> Result<(), std::io::Error> {
    let level = record.level();
    let color = match level {
        log::Level::Error => "\x1b[31m",
        log::Level::Warn => "\x1b[33m",
        log::Level::Info => "\x1b[32m",
        log::Level::Debug => "\x1b[36m",
        log::Level::Trace => "\x1b[90m",
    };
    write!(
        w,
        "{} {:<5}{} \x1b[0m[{}] {}",
        Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
        color,
        level,
        record.module_path_static().unwrap_or_default(),
        record.args()
    )
}

pub fn normalize_log_level(level: &str) -> &str {
    match level {
        "error" | "warn" | "info" | "debug" | "trace" => level,
        _ => "info",
    }
}

pub fn update_log_level(level: &str) -> Result<(), String> {
    let normalized = normalize_log_level(level);
    if normalized != level {
        return Err(format!("Invalid log level: {level}"));
    }
    let handle = LOGGER_HANDLE
        .get()
        .ok_or("Logger not initialized")?;
    let spec = LogSpecification::parse(normalized).map_err(|e| format!("Failed to parse level: {e}"))?;
    handle.set_new_spec(spec);
    Ok(())
}

pub fn cleanup_old_logs(dir: &Path, days: u32) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    let cutoff = Local::now() - chrono::Duration::days(days as i64);

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.extension().is_some_and(|ext| ext == "log") {
            continue;
        }
        let Some(name) = path.file_stem().and_then(|n| n.to_str()) else {
            continue;
        };
        if let Ok(date) = chrono::NaiveDate::parse_from_str(&name[..8], "%Y%m%d") {
            if date < cutoff.date_naive() {
                let _ = fs::remove_file(&path);
            }
        }
    }
}

struct ModuleFilter;

impl flexi_logger::filter::LogLineFilter for ModuleFilter {
    fn write(
        &self,
        now: &mut DeferredNow,
        record: &Record,
        log_line_writer: &dyn flexi_logger::filter::LogLineWriter,
    ) -> Result<(), std::io::Error> {
        let module = record.module_path_static().unwrap_or_default();
        let blocked = [
            "wry",
            "tokio_tungstenite",
            "tungstenite",
            "mio",
            "want",
            "tao"
        ];
        if blocked.iter().any(|prefix| module.starts_with(prefix)) {
            Ok(())
        } else {
            log_line_writer.write(now, record)
        }
    }
}

fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info: &PanicHookInfo| {
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "unknown panic".to_string()
        };

        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "unknown".to_string());

        log::error!(target: "app", "[System] Panic at {location}: {payload}");
        if let Some(handle) = LOGGER_HANDLE.get() {
            handle.flush();
        }
    }));
}

pub fn setup_log(log_dir: Option<&Path>, level: &str, retention_days: u32) {
    if let Some(dir) = log_dir {
        let _ = fs::create_dir_all(dir);
        cleanup_old_logs(dir, retention_days);
    }

    let normalized = normalize_log_level(level);
    let mut logger = Logger::try_with_str(normalized).expect("failed to init logger");

    if let Some(dir) = log_dir {
        let filename = Local::now().format("%Y%m%d-%H%M%S_%3f").to_string();
        let spec = FileSpec::default()
            .directory(dir)
            .basename(&filename)
            .suppress_timestamp();
        logger = logger
            .log_to_file(spec)
            .format_for_files(timestamp_format)
            .write_mode(WriteMode::Direct)
            .rotate(
                flexi_logger::Criterion::Size(DEFAULT_LOG_MAX_SIZE_MB * 1024 * 1024),
                flexi_logger::Naming::TimestampsCustomFormat {
                    current_infix: Some("latest"),
                    format: "%Y%m%d-%H%M%S",
                },
                flexi_logger::Cleanup::KeepLogFiles(KEEP_LOG_FILES),
            );
    }

    #[cfg(not(feature = "prod"))]
    {
        logger = logger
            .duplicate_to_stdout(flexi_logger::Duplicate::All)
            .format_for_stdout(colored_timestamp_format);
    }

    logger = logger.filter(Box::new(ModuleFilter));

    let handle = logger.start().expect("failed to start logger");
    let _ = LOGGER_HANDLE.set(handle);

    install_panic_hook();
}
