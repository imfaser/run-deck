pub mod async_handler;
pub mod mcp_content;
pub mod singleton;

use crate::config::dirs;
use logging::{logging, Type};

/// Log application info: APP_ID, home dir, logs dir, etc.
pub fn log_app_info() {
    logging!(info, Type::Setup, "APP_ID: {}", dirs::APP_ID);

    match dirs::app_home_dir() {
        Ok(home) => logging!(info, Type::Setup, "Home dir: {}", home.display()),
        Err(e) => logging!(warn, Type::Setup, "Home dir: unavailable ({e})"),
    }

    match dirs::app_logs_dir() {
        Ok(logs) => logging!(info, Type::Setup, "Logs dir: {}", logs.display()),
        Err(e) => logging!(warn, Type::Setup, "Logs dir: unavailable ({e})"),
    }
}
