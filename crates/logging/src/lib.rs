use chrono::Local;
use flate2::Compression;
use flate2::write::GzEncoder;
use flexi_logger::{DeferredNow, FileSpec, Logger, LoggerHandle, Record, WriteMode};
use std::fmt;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tar::Builder;

pub const KEEP_LOG_FILES: usize = 5;

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
        }
    }
}

#[macro_export]
macro_rules! logging {
    ($level:ident, $type:expr, $($arg:tt)*) => {
        log::$level!(target: "app", "{} {}", $type, format_args!($($arg)*))
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

pub fn rotate_logs(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    let mut log_files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|ext| ext == "log"))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n != "old.tar.gz")
        })
        .collect();

    if log_files.len() <= KEEP_LOG_FILES {
        return;
    }

    log_files.sort();

    let to_archive = &log_files[..log_files.len() - KEEP_LOG_FILES];
    let archive_path = dir.join("old.tar.gz");

    let archive_file = match File::options()
        .create(true)
        .append(true)
        .open(&archive_path)
    {
        Ok(f) => f,
        Err(_) => return,
    };

    let enc = GzEncoder::new(archive_file, Compression::default());
    let mut tar = Builder::new(enc);

    for path in to_archive {
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            let _ = tar.append_path_with_name(path, name);
        }
    }

    if let Ok(enc) = tar.into_inner() {
        let _ = enc.finish();
    }

    for path in to_archive {
        let _ = fs::remove_file(path);
    }
}

pub fn setup_log(log_dir: Option<&Path>, level: &str) {
    if let Some(dir) = log_dir {
        let _ = fs::create_dir_all(dir);
        rotate_logs(dir);
    }

    let mut logger = Logger::try_with_str(level).expect("failed to init logger");

    if let Some(dir) = log_dir {
        let filename = Local::now().format("%Y%m%d-%H%M%S_%3f").to_string();
        let spec = FileSpec::default().directory(dir).basename(&filename).suppress_timestamp();
        logger = logger
            .log_to_file(spec)
            .format_for_files(timestamp_format)
            .write_mode(WriteMode::Direct);
    }

    #[cfg(not(feature = "prod"))]
    {
        logger = logger
            .duplicate_to_stdout(flexi_logger::Duplicate::All)
            .format_for_stdout(colored_timestamp_format);
    }

    let handle = logger.start().expect("failed to start logger");
    let _ = LOGGER_HANDLE.set(handle);
}
