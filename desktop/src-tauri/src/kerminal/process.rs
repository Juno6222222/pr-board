use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;
use tokio::sync::Mutex;

use super::jsonrpc::{
    serialize_request, serialize_response, IncomingMessage, JsonRpcRequest, JsonRpcResponseMsg,
};

/// Manages the `kerminal app-server` child process.
///
/// Communication is line-delimited JSON over stdin/stdout.
pub struct AppServerProcess {
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    child: Arc<Mutex<Child>>,
    closed: Arc<std::sync::atomic::AtomicBool>,
}

impl AppServerProcess {
    /// Spawn `kerminal app-server` and start reading its stdout.
    ///
    /// Incoming messages are sent to `msg_tx`.
    /// Stderr lines are logged via the default application logger.
    pub fn spawn(
        binary_path: &str,
        env: Vec<(String, String)>,
        msg_tx: mpsc::UnboundedSender<IncomingMessage>,
    ) -> Result<Self, String> {
        log::info!(
            "[kerminal-process] spawn:start binary_path={} env_count={}",
            binary_path,
            env.len()
        );
        let mut cmd = Command::new(binary_path);
        cmd.arg("app-server");
        cmd.stdin(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        // Apply environment
        for (k, v) in &env {
            cmd.env(k, v);
        }

        // Platform-specific: hide window on Windows
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut child = cmd.spawn().map_err(|e| {
            let message = format!("Failed to spawn kerminal app-server: {e}");
            log::error!("[kerminal-process] spawn:failed {message}");
            message
        })?;
        log::info!("[kerminal-process] spawn:done");

        let stdout = child
            .stdout
            .take()
            .ok_or("No stdout from kerminal process")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("No stderr from kerminal process")?;
        let stdin = child.stdin.take().ok_or("No stdin to kerminal process")?;

        let closed = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let closed_clone = closed.clone();

        // Stdout reader task: parse line-delimited JSON-RPC messages
        tokio::spawn(async move {
            log::debug!("[kerminal-process] stdout-reader:start");
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::info!("[kerminal] RECV {line}");

                if line.trim().is_empty() {
                    continue;
                }
                match IncomingMessage::from_str(&line) {
                    Ok(msg) => {
                        if msg_tx.send(msg).is_err() {
                            log::warn!("[kerminal-process] stdout-reader:receiver-dropped");
                            break; // Receiver dropped
                        }
                    }
                    Err(e) => {
                        log::warn!(
                            "[kerminal-process] stdout-reader:parse-failed {e} | line: {}",
                            &line[..line.len().min(200)]
                        );
                    }
                }
            }
            closed_clone.store(true, std::sync::atomic::Ordering::SeqCst);
            log::debug!("[kerminal-process] stdout-reader:done");
        });

        // Stderr reader task
        tokio::spawn(async move {
            log::debug!("[kerminal-process] stderr-reader:start");
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                log::error!("[kerminal] STDERR {line}");
            }
            log::debug!("[kerminal-process] stderr-reader:done");
        });

        Ok(Self {
            stdin: Arc::new(Mutex::new(stdin)),
            child: Arc::new(Mutex::new(child)),
            closed,
        })
    }

    /// Send a JSON-RPC request to the process.
    pub async fn send_request(&self, req: &JsonRpcRequest) -> Result<(), String> {
        if self.closed.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("kerminal process is closed".to_string());
        }
        let data = serialize_request(req);
        log::info!("[kerminal] SEND {}", data.trim());
        let mut stdin = self.stdin.lock().await;
        stdin
            .write_all(data.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to kerminal stdin: {e}"))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush kerminal stdin: {e}"))?;
        Ok(())
    }

    /// Send a JSON-RPC response (for server-initiated requests like approval).
    pub async fn send_response(&self, resp: &JsonRpcResponseMsg) -> Result<(), String> {
        if self.closed.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("kerminal process is closed".to_string());
        }
        let data = serialize_response(resp);
        log::info!("[kerminal] SEND-RESP {}", data.trim());
        let mut stdin = self.stdin.lock().await;
        stdin
            .write_all(data.as_bytes())
            .await
            .map_err(|e| format!("Failed to write response to kerminal stdin: {e}"))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush kerminal stdin: {e}"))?;
        Ok(())
    }

    /// Kill the process.
    pub async fn close(&self) {
        log::info!("[kerminal-process] close:start");
        self.closed.store(true, std::sync::atomic::Ordering::SeqCst);
        drop(self.stdin.lock().await);
        let mut child = self.child.lock().await;
        let _ = child.kill().await;
        log::info!("[kerminal-process] close:done");
    }
}
