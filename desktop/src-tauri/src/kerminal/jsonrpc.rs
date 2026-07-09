use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JSON-RPC request ID (integer, matching the TypeScript SDK)
pub type RequestId = u64;

// ─── Outgoing (client → server) ───

#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcRequest {
    pub id: RequestId,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// Response to a server-initiated request (e.g. approval)
#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcResponseMsg {
    pub id: RequestId,
    pub result: Value,
}

// ─── Incoming (server → client) ───

#[derive(Debug, Clone, Deserialize)]
pub struct RpcErrorDetail {
    pub message: String,
}

/// A parsed incoming JSON-RPC message from kerminal app-server.
///
/// Discriminated by the presence/absence of `id`, `method`, `result`, `error` fields.
#[derive(Debug, Clone)]
pub enum IncomingMessage {
    /// Response to a client request (has `id` + `result`)
    Response { id: RequestId, result: Value },
    /// Error response to a client request (has `id` + `error`)
    Error {
        id: RequestId,
        error: RpcErrorDetail,
    },
    /// Server-initiated request requiring a response (has `id` + `method`)
    ServerRequest {
        id: RequestId,
        method: String,
        params: Option<Value>,
    },
    /// Server notification, no response needed (has `method`, no `id`)
    Notification {
        method: String,
        params: Option<Value>,
    },
}

/// Raw JSON-RPC message for deserialization. We deserialize into this
/// flat struct, then classify into `IncomingMessage`.
#[derive(Debug, Deserialize)]
struct RawMessage {
    id: Option<RequestId>,
    method: Option<String>,
    result: Option<Value>,
    error: Option<RpcErrorDetail>,
    params: Option<Value>,
}

impl IncomingMessage {
    /// Parse a JSON string into an IncomingMessage.
    pub fn from_str(s: &str) -> Result<Self, String> {
        let raw: RawMessage =
            serde_json::from_str(s).map_err(|e| format!("JSON parse error: {e}"))?;
        Self::from_raw(raw)
    }

    fn from_raw(raw: RawMessage) -> Result<Self, String> {
        match (raw.id, raw.method, raw.result, raw.error) {
            // Response: has id + result
            (Some(id), _, Some(result), _) => Ok(IncomingMessage::Response { id, result }),
            // Error: has id + error
            (Some(id), _, _, Some(error)) => Ok(IncomingMessage::Error { id, error }),
            // Server request: has id + method (but not result/error)
            (Some(id), Some(method), None, None) => Ok(IncomingMessage::ServerRequest {
                id,
                method,
                params: raw.params,
            }),
            // Notification: has method but no id
            (None, Some(method), _, _) => Ok(IncomingMessage::Notification {
                method,
                params: raw.params,
            }),
            _ => Err("Unrecognized JSON-RPC message shape".to_string()),
        }
    }
}

/// Serialize a request to a JSON line (with trailing newline).
pub fn serialize_request(req: &JsonRpcRequest) -> String {
    let mut s = serde_json::to_string(req).expect("request serialization");
    s.push('\n');
    s
}

/// Serialize a response to a JSON line (with trailing newline).
pub fn serialize_response(resp: &JsonRpcResponseMsg) -> String {
    let mut s = serde_json::to_string(resp).expect("response serialization");
    s.push('\n');
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_response() {
        let json = r#"{"id":1,"result":{"userAgent":"kerminal/1.0"}}"#;
        match IncomingMessage::from_str(json).unwrap() {
            IncomingMessage::Response { id, result } => {
                assert_eq!(id, 1);
                assert_eq!(result["userAgent"], "kerminal/1.0");
            }
            other => panic!("expected Response, got {:?}", other),
        }
    }

    #[test]
    fn parse_error() {
        let json = r#"{"id":2,"error":{"code":-1,"message":"not initialized"}}"#;
        match IncomingMessage::from_str(json).unwrap() {
            IncomingMessage::Error { id, error } => {
                assert_eq!(id, 2);
                assert_eq!(error.message, "not initialized");
            }
            other => panic!("expected Error, got {:?}", other),
        }
    }

    #[test]
    fn parse_server_request() {
        let json = r#"{"id":99,"method":"execCommandApproval","params":{"command":["ls"]}}"#;
        match IncomingMessage::from_str(json).unwrap() {
            IncomingMessage::ServerRequest { id, method, params } => {
                assert_eq!(id, 99);
                assert_eq!(method, "execCommandApproval");
                assert!(params.is_some());
            }
            other => panic!("expected ServerRequest, got {:?}", other),
        }
    }

    #[test]
    fn parse_notification() {
        let json = r#"{"method":"kerminal/event/msg","params":{"conversationId":"c1","id":"t1","msg":{"type":"task_started"}}}"#;
        match IncomingMessage::from_str(json).unwrap() {
            IncomingMessage::Notification { method, params } => {
                assert_eq!(method, "kerminal/event/msg");
                assert!(params.is_some());
            }
            other => panic!("expected Notification, got {:?}", other),
        }
    }

    #[test]
    fn serialize_request_has_newline() {
        let req = JsonRpcRequest {
            id: 1,
            method: "initialize".into(),
            params: None,
        };
        let s = serialize_request(&req);
        assert!(s.ends_with('\n'));
        assert!(!s[..s.len() - 1].contains('\n'));
    }
}
