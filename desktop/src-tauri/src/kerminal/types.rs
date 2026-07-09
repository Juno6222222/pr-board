use serde::{Deserialize, Serialize};
use serde_json::Value;

// ─── Client Info ───

#[derive(Debug, Clone, Serialize)]
pub struct ClientInfo {
    pub name: String,
    pub title: Option<String>,
    pub version: String,
}

// ─── Conversation ───

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewConversationOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_policy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_apply_patch_tool: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewConversationResponse {
    pub conversation_id: String,
    pub model: String,
    pub rollout_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddConversationSubscriptionResponse {
    pub subscription_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetUserAgentResponse {
    pub user_agent: String,
}

// ─── Input ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputItem {
    #[serde(rename = "type")]
    pub item_type: String,
    pub data: Value,
}

// ─── Send User Turn ───

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendUserTurnParams {
    pub conversation_id: String,
    pub items: Vec<InputItem>,
    pub cwd: String,
    pub approval_policy: String,
    pub sandbox_policy: Value,
    pub model: String,
    pub effort: Option<String>,
    pub summary: String,
}

// ─── Server-Initiated Requests ───

/// A server-initiated request from kerminal app-server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub id: u64,
    pub method: String,
    pub params: Value,
}

// ─── Events ───

/// A kerminal event forwarded to the frontend.
/// EventMsg is kept as opaque JSON (Value) to avoid having to replicate
/// all 50+ event types in Rust. The frontend TypeScript handles parsing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KerminalEvent {
    pub conversation_id: String,
    pub turn_id: String,
    pub msg: Value,
}
