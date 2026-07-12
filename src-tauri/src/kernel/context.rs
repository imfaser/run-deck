use crate::singleton;
use crate::{APP_HANDLE, MCP_MANAGER};
use chrono::Local;
use mcp::McpManager;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

use super::notification::{FrontendEvent, NotificationSystem};

#[derive(Debug)]
pub struct AppContext {
    is_exiting: AtomicBool,
}

impl Default for AppContext {
    fn default() -> Self {
        Self {
            is_exiting: AtomicBool::new(false),
        }
    }
}

singleton!(AppContext, APP_CONTEXT);

impl AppContext {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn app_handle() -> &'static AppHandle {
        #[allow(clippy::expect_used)]
        APP_HANDLE.get().expect("App handle not initialized")
    }

    pub fn mcp_manager() -> &'static McpManager {
        #[allow(clippy::expect_used)]
        MCP_MANAGER.get().expect("MCP manager not initialized")
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

    fn send_event(event: FrontendEvent) {
        let ctx = Self::global();
        if ctx.is_exiting() {
            return;
        }

        NotificationSystem::send_event(Self::app_handle(), event);
    }
}
