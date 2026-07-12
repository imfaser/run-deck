use crate::APP_HANDLE;
use anyhow::Result;
use logging::{logging, Type};
use std::path::PathBuf;
use tauri::Manager as _;

pub const APP_ID: &str = "run-deck";

/// Compile-time project root: parent of `src-tauri/` (where Cargo.toml lives)
fn project_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent().unwrap_or(&manifest_dir).to_path_buf()
}

/// Get the app home directory.
/// - `prod` feature ON:  `data_dir / "run-deck"`
/// - `prod` feature OFF: `<project_root> / ".app"`
#[cfg(feature = "prod")]
pub fn app_home_dir() -> Result<PathBuf> {
    let app_handle = APP_HANDLE
        .get()
        .ok_or_else(|| anyhow::anyhow!("App handle not initialized"))?;

    match app_handle.path().data_dir() {
        Ok(dir) => Ok(dir.join(APP_ID)),
        Err(e) => Err(anyhow::anyhow!("Failed to get data directory: {e}")),
    }
}

#[cfg(not(feature = "prod"))]
pub fn app_home_dir() -> Result<PathBuf> {
    Ok(project_root().join(".app"))
}

/// Logs directory
pub fn app_logs_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("logs"))
}

/// Profiles directory
pub fn app_profiles_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("profiles"))
}

/// Icons directory
pub fn app_icons_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("icons"))
}

/// Tauri resource directory
pub fn app_resources_dir() -> Result<PathBuf> {
    let app_handle = APP_HANDLE
        .get()
        .ok_or_else(|| anyhow::anyhow!("App handle not initialized"))?;

    match app_handle.path().resource_dir() {
        Ok(dir) => Ok(dir.join("resources")),
        Err(e) => Err(anyhow::anyhow!("Failed to get resource directory: {e}")),
    }
}

/// Config file path (config.json)
pub fn config_file() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("config.json"))
}

/// Convert a `PathBuf` to `&str`
pub fn path_to_str(path: &PathBuf) -> Result<&str> {
    path.as_os_str()
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Failed to convert path to string: {path:?}"))
}

/// Sync extension for `PathBuf`
pub trait PathBufExec {
    fn remove_if_exists(&self) -> Result<()>;
}

impl PathBufExec for PathBuf {
    fn remove_if_exists(&self) -> Result<()> {
        if self.exists() {
            std::fs::remove_file(self)?;
            logging!(info, Type::File, "Removed file: {:?}", self);
        }
        Ok(())
    }
}
