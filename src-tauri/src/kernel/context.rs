use crate::singleton;
use crate::utils::content_cache::ContentCache;
use crate::{APP_HANDLE, MCP_MANAGER, DB, VOLUME_STORE};
use chrono::Local;
use crate::config::Config;
use draft::Draft;
use mcp::McpManager;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

use super::notification::{FrontendEvent, NotificationSystem};
use super::volume_store::VolumeStore;

#[derive(Debug)]
pub struct AppContext {
    is_exiting: AtomicBool,
}

singleton!(AppContext, APP_CONTEXT);

impl AppContext {
    pub fn new() -> Self {
        Self {
            is_exiting: AtomicBool::new(false),
        }
    }

    pub fn app_handle() -> &'static AppHandle {
        #[allow(clippy::expect_used)]
        APP_HANDLE.get().expect("app handle not initialized")
    }

    pub fn config() -> &'static Draft<Config> {
        Config::global()
    }

    pub fn mcp_manager() -> &'static McpManager {
        #[allow(clippy::expect_used)]
        MCP_MANAGER.get().expect("MCP manager not initialized")
    }

    pub fn content_cache() -> &'static ContentCache {
        ContentCache::global()
    }

    pub fn db() -> &'static toasty::Db {
        #[allow(clippy::expect_used)]
        DB.get().expect("DB not initialized")
    }

    pub fn volume_store() -> &'static VolumeStore {
        #[allow(clippy::expect_used)]
        VOLUME_STORE.get().expect("VolumeStore not initialized")
    }

    pub fn set_is_exiting(&self) {
        self.is_exiting.store(true, Ordering::Release);
    }

    pub fn is_exiting(&self) -> bool {
        self.is_exiting.load(Ordering::Acquire)
    }

    pub fn send_ping() {
        Self::send_event(FrontendEvent::Ping {
            timestamp: Local::now().to_rfc3339(),
        });
    }

    pub(crate) fn send_event(event: FrontendEvent) {
        let ctx = Self::global();
        if ctx.is_exiting() {
            return;
        }

        NotificationSystem::send_event(Self::app_handle(), event);
    }
}
