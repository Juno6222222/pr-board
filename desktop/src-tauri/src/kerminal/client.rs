use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use serde_json::{json, Value};
use tokio::sync::{broadcast, mpsc, oneshot, Mutex};

use super::jsonrpc::{IncomingMessage, JsonRpcRequest, JsonRpcResponseMsg, RequestId};
use super::process::AppServerProcess;
use super::types::*;

type PendingResult = Result<Value, String>;

/// High-level client for communicating with `kerminal app-server` via JSON-RPC.
///
/// Mirrors the TypeScript SDK's `KerminalClient` class.
pub struct KerminalClient {
    process: AppServerProcess,
    pending: Arc<Mutex<HashMap<RequestId, oneshot::Sender<PendingResult>>>>,
    next_id: AtomicU64,
    /// Broadcast channel for kerminal events (forwarded to frontend via Tauri events).
    pub event_tx: broadcast::Sender<KerminalEvent>,
    approval_rx: Arc<Mutex<Option<mpsc::UnboundedReceiver<ApprovalRequest>>>>,
    /// Track listener subscriptions per conversation.
    listener_subscriptions: Arc<Mutex<HashMap<String, String>>>,
}

impl KerminalClient {
    /// Create a new client and spawn `kerminal app-server`.
    pub fn new(binary_path: &str, env: Vec<(String, String)>) -> Result<Self, String> {
        let (msg_tx, msg_rx) = mpsc::unbounded_channel();
        let process = AppServerProcess::spawn(binary_path, env, msg_tx)?;

        let (event_tx, _) = broadcast::channel(256);
        let (approval_tx, approval_rx) = mpsc::unbounded_channel();

        let pending = Arc::new(Mutex::new(HashMap::<
            RequestId,
            oneshot::Sender<PendingResult>,
        >::new()));

        let client = Self {
            process,
            pending: pending.clone(),
            next_id: AtomicU64::new(1),
            event_tx: event_tx.clone(),
            approval_rx: Arc::new(Mutex::new(Some(approval_rx))),
            listener_subscriptions: Arc::new(Mutex::new(HashMap::new())),
        };

        tokio::spawn(Self::dispatch_loop(msg_rx, pending, event_tx, approval_tx));

        Ok(client)
    }

    /// Take the server request receiver (can only be called once).
    /// Used by the Tauri event forwarder to listen for approvals and user input requests.
    pub async fn take_approval_rx(&self) -> Option<mpsc::UnboundedReceiver<ApprovalRequest>> {
        self.approval_rx.lock().await.take()
    }

    // ─── Public API ───

    pub async fn initialize(&self, client_info: ClientInfo) -> Result<(), String> {
        self.send_request("initialize", Some(json!({ "clientInfo": client_info })))
            .await?;
        Ok(())
    }

    pub async fn new_conversation(
        &self,
        options: NewConversationOptions,
    ) -> Result<NewConversationResponse, String> {
        let params = serde_json::to_value(&options).map_err(|e| format!("serialize error: {e}"))?;
        let result = self.send_request("newConversation", Some(params)).await?;
        serde_json::from_value(result).map_err(|e| format!("newConversation parse error: {e}"))
    }

    pub async fn list_conversations(
        &self,
        page_size: Option<usize>,
        cursor: Option<&str>,
    ) -> Result<Value, String> {
        let params = json!({ "pageSize": page_size, "cursor": cursor });
        self.send_request("listConversations", Some(params)).await
    }

    pub async fn get_user_agent(&self) -> Result<String, String> {
        let result = self.send_request("getUserAgent", None).await?;
        let response: GetUserAgentResponse =
            serde_json::from_value(result).map_err(|e| format!("getUserAgent parse error: {e}"))?;
        Ok(response.user_agent)
    }

    pub async fn resume_conversation(
        &self,
        path: &str,
        overrides: Option<NewConversationOptions>,
    ) -> Result<Value, String> {
        let params = json!({
            "path": path,
            "overrides": overrides,
        });
        self.send_request("resumeConversation", Some(params)).await
    }

    pub async fn add_conversation_listener(
        &self,
        conversation_id: &str,
    ) -> Result<AddConversationSubscriptionResponse, String> {
        {
            let subs = self.listener_subscriptions.lock().await;
            if subs.contains_key(conversation_id) {
                return Err(format!(
                    "Only one listener is allowed per conversation: {conversation_id}"
                ));
            }
        }

        // Reserve the slot while the RPC request is in flight.
        {
            let mut subs = self.listener_subscriptions.lock().await;
            subs.insert(conversation_id.to_string(), String::new());
        }

        let params = json!({
            "conversationId": conversation_id,
            "experimentalRawEvents": false,
        });

        match self
            .send_request("addConversationListener", Some(params))
            .await
        {
            Ok(result) => {
                let resp: AddConversationSubscriptionResponse = serde_json::from_value(result)
                    .map_err(|e| format!("addConversationListener parse error: {e}"))?;
                let mut subs = self.listener_subscriptions.lock().await;
                subs.insert(conversation_id.to_string(), resp.subscription_id.clone());
                Ok(resp)
            }
            Err(e) => {
                let mut subs = self.listener_subscriptions.lock().await;
                subs.remove(conversation_id);
                Err(e)
            }
        }
    }

    pub async fn rebind_conversation_listener(
        &self,
        conversation_id: &str,
    ) -> Result<AddConversationSubscriptionResponse, String> {
        let existing_subscription = {
            let mut subs = self.listener_subscriptions.lock().await;
            subs.remove(conversation_id)
        };

        if let Some(subscription_id) = existing_subscription.filter(|id| !id.is_empty()) {
            let params = json!({ "subscriptionId": subscription_id });
            let _ = self
                .send_request("removeConversationListener", Some(params))
                .await;
        }

        self.add_conversation_listener(conversation_id).await
    }

    pub async fn remove_conversation_listener(&self, conversation_id: &str) -> Result<(), String> {
        let existing_subscription = {
            let mut subs = self.listener_subscriptions.lock().await;
            subs.remove(conversation_id)
        };

        let Some(subscription_id) = existing_subscription.filter(|id| !id.is_empty()) else {
            return Ok(());
        };

        let params = json!({ "subscriptionId": subscription_id });
        self.send_request("removeConversationListener", Some(params))
            .await?;
        Ok(())
    }

    pub async fn send_user_turn(&self, params: SendUserTurnParams) -> Result<Value, String> {
        let value = serde_json::to_value(&params).map_err(|e| format!("serialize error: {e}"))?;
        self.send_request("sendUserTurn", Some(value)).await
    }

    pub async fn interrupt_conversation(&self, conversation_id: &str) {
        let params = json!({ "conversationId": conversation_id });
        // Fire-and-forget: don't track pending
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let req = JsonRpcRequest {
            id,
            method: "interruptConversation".to_string(),
            params: Some(params),
        };
        let _ = self.process.send_request(&req).await;
    }

    pub async fn respond_approval(&self, request_id: u64, decision: &str) -> Result<(), String> {
        let resp = JsonRpcResponseMsg {
            id: request_id,
            result: json!({ "decision": decision }),
        };
        self.process.send_response(&resp).await
    }

    pub async fn respond_user_input(
        &self,
        request_id: u64,
        answers: HashMap<String, String>,
    ) -> Result<(), String> {
        let resp = JsonRpcResponseMsg {
            id: request_id,
            result: json!({ "answers": answers }),
        };
        self.process.send_response(&resp).await
    }

    pub async fn delete_conversation(
        &self,
        conversation_id: &str,
        rollout_path: &str,
    ) -> Result<Value, String> {
        let params = json!({ "conversationId": conversation_id, "rolloutPath": rollout_path });
        self.send_request("deleteConversation", Some(params)).await
    }

    pub async fn close(&self) {
        // Reject all pending requests
        let mut pending = self.pending.lock().await;
        for (_, sender) in pending.drain() {
            let _ = sender.send(Err("kerminal client is closing".to_string()));
        }
        drop(pending);

        self.listener_subscriptions.lock().await.clear();
        self.process.close().await;
    }

    // ─── Internal ───

    async fn send_request(&self, method: &str, params: Option<Value>) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let req = JsonRpcRequest {
            id,
            method: method.to_string(),
            params,
        };

        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending.lock().await;
            pending.insert(id, tx);
        }

        if let Err(e) = self.process.send_request(&req).await {
            let mut pending = self.pending.lock().await;
            pending.remove(&id);
            return Err(e);
        }

        rx.await.map_err(|_| "Request cancelled".to_string())?
    }

    /// Message dispatch loop: routes incoming messages to the right handler.
    async fn dispatch_loop(
        mut msg_rx: mpsc::UnboundedReceiver<IncomingMessage>,
        pending: Arc<Mutex<HashMap<RequestId, oneshot::Sender<PendingResult>>>>,
        event_tx: broadcast::Sender<KerminalEvent>,
        approval_tx: mpsc::UnboundedSender<ApprovalRequest>,
    ) {
        while let Some(msg) = msg_rx.recv().await {
            match msg {
                IncomingMessage::Response { id, result } => {
                    let mut pending = pending.lock().await;
                    if let Some(sender) = pending.remove(&id) {
                        let _ = sender.send(Ok(result));
                    }
                }
                IncomingMessage::Error { id, error } => {
                    let mut pending = pending.lock().await;
                    if let Some(sender) = pending.remove(&id) {
                        let _ = sender.send(Err(error.message));
                    }
                }
                IncomingMessage::ServerRequest { id, method, params } => {
                    if matches!(
                        method.as_str(),
                        "execCommandApproval" | "applyPatchApproval" | "requestUserInput"
                    ) {
                        let request = ApprovalRequest {
                            id,
                            method,
                            params: params.unwrap_or(Value::Null),
                        };
                        let _ = approval_tx.send(request);
                    } else {
                        log::error!("[kerminal] Unhandled server request: {method}");
                    }
                }
                IncomingMessage::Notification { method, params } => {
                    if method.starts_with("kerminal/event/") {
                        if let Some(payload) = params {
                            let conversation_id = payload
                                .get("conversationId")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let turn_id = payload
                                .get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let msg = payload.get("msg").cloned().unwrap_or(Value::Null);

                            let event = KerminalEvent {
                                conversation_id,
                                turn_id,
                                msg,
                            };
                            let _ = event_tx.send(event);
                        }
                    }
                    // Other notifications (authStatusChange, sessionConfigured) can be
                    // handled here later if needed.
                }
            }
        }
    }
}
