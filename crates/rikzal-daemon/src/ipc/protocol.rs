use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Message {
    Ping,
    Pong,
    BriefReady {
        date: String,
        narrative: String,
        audio_path: Option<String>,
    },
    AttentionUpdate {
        items: Vec<AttentionItemMsg>,
    },
    ConnectorStatus {
        connector_id: String,
        status: String,
        error: Option<String>,
    },
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttentionItemMsg {
    pub id: String,
    pub rank: u32,
    pub item_type: String,
    pub headline: String,
    pub why_now: String,
    pub action_hint: Option<String>,
}
