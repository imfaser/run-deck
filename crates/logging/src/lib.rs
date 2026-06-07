use std::fmt;

#[derive(Debug, PartialEq, Eq)]
pub enum Type {
    Cmd,
    Setup,
    System,
    Config,
    Frontend,
    File,
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
            log::error!(target: "app", "[{}] {}", $type, err);
        }
    };

    ($type:expr, $fmt:literal $(, $arg:expr)*) => {
        log::error!(target: "app", "[{}] {}", $type, format_args!($fmt $(, $arg)*));
    };
}

pub fn setup_log() {
    let _ = flexi_logger::Logger::try_with_env_or_str("info")
        .expect("failed to init logger")
        .log_to_stdout()
        .format_for_stdout(|w, now, record| {
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
                "\x1b[90m{}\x1b[0m {}{} \x1b[0m{}",
                now.now().format("%Y-%m-%d-%H:%M:%S_%3f"),
                color,
                level,
                record.args()
            )
        })
        .start()
        .expect("failed to start logger");
}
