// OS-level integration: notifications, login hooks, file watching.
// Stubbed for Phase 0 — expanded in Phase 2.

pub fn send_notification(title: &str, body: &str) {
    tracing::info!("Notification: [{title}] {body}");
    // TODO: platform-native notifications via notify-rust or mac-notification-sys
}
