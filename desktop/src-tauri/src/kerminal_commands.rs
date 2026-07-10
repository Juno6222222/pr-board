use std::sync::Arc;

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

use crate::kerminal::client::KerminalClient;
use crate::kerminal::types::{
    ClientInfo, InputItem, KerminalEvent, NewConversationOptions, SendUserTurnParams,
};
use crate::kerminal_binary::resolve_kerminal_binary;

/// Global Kerminal client state.
#[derive(Default)]
pub struct KerminalState {
    pub client: Arc<Mutex<Option<KerminalClient>>>,
}

fn kerflow_home() -> String {
    // Reuse KerWork's kerminal home (config, auth, sessions).
    let home = dirs_home();
    format!("{home}/.kerwork")
}

fn dirs_home() -> String {
    std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
}

/// Start kerminal app-server, initialize, and begin forwarding events.
#[tauri::command]
pub async fn kerminal_start(
    app: AppHandle,
    state: tauri::State<'_, KerminalState>,
) -> Result<(), String> {
    // Already started?
    {
        let guard = state.client.lock().await;
        if guard.is_some() {
            return Ok(());
        }
    }

    let binary_path = resolve_kerminal_binary()?;

    let system_path = std::env::var("PATH")
        .unwrap_or_else(|_| "/usr/local/bin:/usr/bin:/bin".to_string());

    let env = vec![
        ("KERNELCAT".to_string(), "1".to_string()),
        ("KERMINAL_HOME".to_string(), kerflow_home()),
        ("PATH".to_string(), system_path),
    ];

    let client = KerminalClient::new(&binary_path, env)?;

    client
        .initialize(ClientInfo {
            name: "KerFlow".to_string(),
            title: Some("KerFlow".to_string()),
            version: "0.1.0".to_string(),
        })
        .await?;

    // Forward kerminal events to the frontend.
    let mut event_rx = client.event_tx.subscribe();
    let app_handle = app.clone();
    tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            let _ = app_handle.emit("kerminal-event", &event);
        }
    });

    // Forward approval requests to the frontend.
    if let Some(mut approval_rx) = client.take_approval_rx().await {
        let app_handle = app.clone();
        tokio::spawn(async move {
            while let Some(req) = approval_rx.recv().await {
                let _ = app_handle.emit("kerminal-approval", &req);
            }
        });
    }

    {
        let mut guard = state.client.lock().await;
        *guard = Some(client);
    }

    Ok(())
}

/// Result of creating/resuming a conversation.
#[derive(serde::Serialize)]
pub struct ConversationInfo {
    pub conversation_id: String,
    pub rollout_path: Option<String>,
}

/// Create a new conversation. Returns the conversation id + rollout path.
#[tauri::command]
pub async fn kerminal_new_conversation(
    state: tauri::State<'_, KerminalState>,
    cwd: String,
) -> Result<ConversationInfo, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Kerminal not started")?;

    let options = NewConversationOptions {
        cwd: Some(cwd),
        approval_policy: Some("on-request".to_string()),
        ..Default::default()
    };

    let resp = client.new_conversation(options).await?;
    client
        .add_conversation_listener(&resp.conversation_id)
        .await?;

    Ok(ConversationInfo {
        conversation_id: resp.conversation_id,
        rollout_path: resp.rollout_path,
    })
}

/// Resume an existing conversation from its rollout file.
#[tauri::command]
pub async fn kerminal_resume_conversation(
    state: tauri::State<'_, KerminalState>,
    rollout_path: String,
) -> Result<ConversationInfo, String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Kerminal not started")?;

    let result = client.resume_conversation(&rollout_path, None).await?;
    let conversation_id = result
        .get("conversationId")
        .and_then(|v| v.as_str())
        .ok_or("resumeConversation: missing conversationId")?
        .to_string();

    client.add_conversation_listener(&conversation_id).await?;

    Ok(ConversationInfo {
        conversation_id,
        rollout_path: Some(rollout_path),
    })
}

/// Send a user message to a conversation.
#[tauri::command]
pub async fn kerminal_send_message(
    state: tauri::State<'_, KerminalState>,
    conversation_id: String,
    cwd: String,
    text: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Kerminal not started")?;

    let params = SendUserTurnParams {
        conversation_id,
        items: vec![InputItem {
            item_type: "text".to_string(),
            data: json!({ "text": text }),
        }],
        cwd,
        approval_policy: "on-request".to_string(),
        sandbox_policy: json!({ "mode": "danger-full-access" }),
        model: "kernelcat1.0".to_string(),
        effort: None,
        summary: "auto".to_string(),
    };

    client.send_user_turn(params).await?;
    Ok(())
}

/// Respond to an approval request.
#[tauri::command]
pub async fn kerminal_respond_approval(
    state: tauri::State<'_, KerminalState>,
    request_id: u64,
    decision: String,
) -> Result<(), String> {
    let guard = state.client.lock().await;
    let client = guard.as_ref().ok_or("Kerminal not started")?;
    client.respond_approval(request_id, &decision).await
}

// Keep KerminalEvent referenced for serialization.
#[allow(dead_code)]
fn _touch(_e: KerminalEvent, _s: &tauri::State<'_, KerminalState>, _a: &AppHandle) {}
