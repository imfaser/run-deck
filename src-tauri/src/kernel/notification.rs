use logging::{logging, Type};
use serde_json::json;
use tauri::{AppHandle, Emitter as _};

#[derive(Debug)]
pub enum FrontendEvent {
    Ping { timestamp: String },
    DbChanged,
    ConfigChanged,
}

pub struct NotificationSystem;

impl NotificationSystem {
    pub fn send_event(app: &AppHandle, event: FrontendEvent) {
        let (name, payload) = Self::serialize(event);
        if let Err(e) = app.emit(name, payload) {
            logging!(warn, Type::Frontend, "Event emit failed: {e}");
        }
    }

    fn serialize(event: FrontendEvent) -> (&'static str, serde_json::Value) {
        match event {
            FrontendEvent::Ping { timestamp } => ("run-deck://ping", json!(timestamp)),
            FrontendEvent::DbChanged => ("run-deck://db-changed", json!(null)),
            FrontendEvent::ConfigChanged => ("run-deck://config-changed", json!(null)),
        }
    }
}
