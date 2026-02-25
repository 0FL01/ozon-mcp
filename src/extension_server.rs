use anyhow::{Context, Result, anyhow, bail};
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{Mutex, mpsc, oneshot};
use tokio::task::{JoinHandle, JoinSet};
use tokio::time::{Duration, timeout};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{WebSocketStream, accept_async};

const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
const NOT_CONNECTED_ERROR: &str =
    "Extension not connected. Please click the extension icon and click \"Connect\".";
const ALREADY_CONNECTED_ERROR: &str =
    "Another browser is already connected. Only one browser can be connected at a time.";

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct ExtensionServerConfig {
    pub host: String,
    pub port: u16,
}

impl Default for ExtensionServerConfig {
    fn default() -> Self {
        Self {
            host: String::from("127.0.0.1"),
            port: 5555,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ExtensionCommand {
    pub method: String,
    pub params: Value,
}

impl ExtensionCommand {
    pub fn new(method: impl Into<String>, params: Value) -> Self {
        Self {
            method: method.into(),
            params,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ExtensionResponse {
    pub request_method: String,
    pub payload: Value,
}

#[derive(Debug)]
pub struct ExtensionServer {
    config: ExtensionServerConfig,
    shared: Arc<SharedState>,
}

impl ExtensionServer {
    pub fn new(config: ExtensionServerConfig) -> Self {
        Self::with_timeout(config, COMMAND_TIMEOUT)
    }

    fn with_timeout(config: ExtensionServerConfig, command_timeout: Duration) -> Self {
        Self {
            config,
            shared: Arc::new(SharedState::new(command_timeout)),
        }
    }

    pub fn config(&self) -> &ExtensionServerConfig {
        &self.config
    }

    pub async fn start(&self) -> Result<()> {
        let mut lifecycle = self.shared.lifecycle.lock().await;
        if lifecycle.listener_task.is_some() {
            bail!("extension bridge is already started");
        }

        let bind_addr = format!("{}:{}", self.config.host, self.config.port);
        let listener = TcpListener::bind(&bind_addr)
            .await
            .with_context(|| format!("failed to bind extension websocket bridge at {bind_addr}"))?;
        let local_addr = listener
            .local_addr()
            .context("failed to get local websocket listener address")?;

        if let Ok(mut bound_addr) = self.shared.bound_addr.lock() {
            *bound_addr = Some(local_addr);
        }

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let shared = Arc::clone(&self.shared);
        let listener_task = tokio::spawn(async move {
            run_listener(listener, shared, shutdown_rx).await;
        });

        lifecycle.shutdown_tx = Some(shutdown_tx);
        lifecycle.listener_task = Some(listener_task);

        Ok(())
    }

    pub async fn stop(&self) -> Result<()> {
        let (shutdown_tx, listener_task) = {
            let mut lifecycle = self.shared.lifecycle.lock().await;
            (lifecycle.shutdown_tx.take(), lifecycle.listener_task.take())
        };

        if let Some(shutdown_tx) = shutdown_tx {
            let _ = shutdown_tx.send(());
        }

        let close_connection_tx = {
            let mut connection = self.shared.connection.lock().await;
            connection.active_connection_id = None;
            connection.command_tx = None;
            connection.close_tx.take()
        };
        if let Some(close_connection_tx) = close_connection_tx {
            let _ = close_connection_tx.send(());
        }

        reject_all_pending(&self.shared, "Extension bridge stopped.").await;

        if let Some(listener_task) = listener_task {
            listener_task
                .await
                .map_err(|error| anyhow!("extension listener task failed: {error}"))?;
        }

        self.shared.connected.store(false, Ordering::Release);
        if let Ok(mut bound_addr) = self.shared.bound_addr.lock() {
            *bound_addr = None;
        }

        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        self.shared.connected.load(Ordering::Acquire)
    }

    pub async fn send_command(&self, command: ExtensionCommand) -> Result<ExtensionResponse> {
        if !self.is_started().await {
            bail!("extension bridge is not started");
        }

        let command_tx = {
            let connection = self.shared.connection.lock().await;
            connection.command_tx.clone()
        }
        .ok_or_else(|| anyhow!(NOT_CONNECTED_ERROR))?;

        let request_method = command.method;
        let request_id = self
            .shared
            .next_request_id
            .fetch_add(1, Ordering::Relaxed)
            .to_string();

        let payload = json!({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": request_method,
            "params": command.params,
        });
        let payload = serde_json::to_string(&payload)
            .context("failed to serialize extension command payload")?;

        let (response_tx, response_rx) = oneshot::channel();
        {
            let mut pending = self.shared.pending.lock().await;
            pending.insert(request_id.clone(), response_tx);
        }

        if command_tx
            .send(OutgoingCommand {
                request_id: request_id.clone(),
                payload,
            })
            .is_err()
        {
            remove_pending_request(&self.shared, &request_id).await;
            bail!("extension connection is not available");
        }

        let response = match timeout(self.shared.command_timeout, response_rx).await {
            Ok(Ok(response)) => response,
            Ok(Err(_)) => {
                remove_pending_request(&self.shared, &request_id).await;
                bail!(
                    "extension connection closed while waiting for response to method: {request_method}"
                );
            }
            Err(_) => {
                remove_pending_request(&self.shared, &request_id).await;
                bail!("request timeout: {request_method}");
            }
        }?;

        Ok(ExtensionResponse {
            request_method,
            payload: response,
        })
    }

    async fn is_started(&self) -> bool {
        let lifecycle = self.shared.lifecycle.lock().await;
        lifecycle.listener_task.is_some()
    }

    #[cfg(test)]
    fn bound_addr(&self) -> Option<SocketAddr> {
        if let Ok(bound_addr) = self.shared.bound_addr.lock() {
            *bound_addr
        } else {
            None
        }
    }
}

#[derive(Debug)]
struct SharedState {
    command_timeout: Duration,
    next_request_id: AtomicU64,
    next_connection_id: AtomicU64,
    connected: AtomicBool,
    pending: Mutex<HashMap<String, oneshot::Sender<Result<Value>>>>,
    connection: Mutex<ConnectionState>,
    lifecycle: Mutex<LifecycleState>,
    bound_addr: StdMutex<Option<SocketAddr>>,
}

impl SharedState {
    fn new(command_timeout: Duration) -> Self {
        Self {
            command_timeout,
            next_request_id: AtomicU64::new(1),
            next_connection_id: AtomicU64::new(1),
            connected: AtomicBool::new(false),
            pending: Mutex::new(HashMap::new()),
            connection: Mutex::new(ConnectionState::default()),
            lifecycle: Mutex::new(LifecycleState::default()),
            bound_addr: StdMutex::new(None),
        }
    }
}

#[derive(Debug, Default)]
struct ConnectionState {
    active_connection_id: Option<u64>,
    command_tx: Option<mpsc::UnboundedSender<OutgoingCommand>>,
    close_tx: Option<oneshot::Sender<()>>,
}

#[derive(Debug, Default)]
struct LifecycleState {
    listener_task: Option<JoinHandle<()>>,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

#[derive(Debug)]
struct OutgoingCommand {
    request_id: String,
    payload: String,
}

async fn run_listener(
    listener: TcpListener,
    shared: Arc<SharedState>,
    mut shutdown_rx: oneshot::Receiver<()>,
) {
    let mut connection_tasks = JoinSet::new();

    loop {
        tokio::select! {
            _ = &mut shutdown_rx => {
                break;
            }
            join_result = connection_tasks.join_next(), if !connection_tasks.is_empty() => {
                if let Some(Err(_)) = join_result {}
            }
            accept_result = listener.accept() => {
                let (stream, _) = match accept_result {
                    Ok(values) => values,
                    Err(_) => continue,
                };

                let connection_id = shared.next_connection_id.fetch_add(1, Ordering::Relaxed);
                let shared_for_connection = Arc::clone(&shared);
                connection_tasks.spawn(async move {
                    let _ = run_connection(stream, shared_for_connection, connection_id).await;
                });
            }
        }
    }

    connection_tasks.abort_all();
    while connection_tasks.join_next().await.is_some() {}
}

async fn run_connection(
    stream: TcpStream,
    shared: Arc<SharedState>,
    connection_id: u64,
) -> Result<()> {
    let mut websocket = accept_async(stream)
        .await
        .context("failed websocket handshake with extension")?;

    let (command_tx, mut command_rx) = mpsc::unbounded_channel();
    let (close_tx, mut close_rx) = oneshot::channel();

    if !try_set_active_connection(&shared, connection_id, command_tx, close_tx).await {
        send_already_connected_error(&mut websocket).await;
        let _ = websocket.close(None).await;
        return Ok(());
    }

    loop {
        tokio::select! {
            _ = &mut close_rx => {
                let _ = websocket.close(None).await;
                break;
            }
            outgoing_command = command_rx.recv() => {
                let Some(outgoing_command) = outgoing_command else {
                    break;
                };

                if websocket
                    .send(Message::Text(outgoing_command.payload.into()))
                    .await
                    .is_err()
                {
                    reject_pending_request(
                        &shared,
                        &outgoing_command.request_id,
                        "extension connection closed before command write completed",
                    )
                    .await;
                    break;
                }
            }
            incoming_message = websocket.next() => {
                let Some(incoming_message) = incoming_message else {
                    break;
                };

                let incoming_message = match incoming_message {
                    Ok(message) => message,
                    Err(_) => break,
                };

                if !handle_incoming_message(&shared, incoming_message).await {
                    break;
                }
            }
        }
    }

    if clear_active_connection(&shared, connection_id).await {
        reject_all_pending(
            &shared,
            "Extension disconnected. Please reconnect the browser extension.",
        )
        .await;
    }

    Ok(())
}

async fn try_set_active_connection(
    shared: &Arc<SharedState>,
    connection_id: u64,
    command_tx: mpsc::UnboundedSender<OutgoingCommand>,
    close_tx: oneshot::Sender<()>,
) -> bool {
    let mut connection = shared.connection.lock().await;
    if connection.active_connection_id.is_some() {
        return false;
    }

    connection.active_connection_id = Some(connection_id);
    connection.command_tx = Some(command_tx);
    connection.close_tx = Some(close_tx);
    shared.connected.store(true, Ordering::Release);
    true
}

async fn clear_active_connection(shared: &Arc<SharedState>, connection_id: u64) -> bool {
    let mut connection = shared.connection.lock().await;
    if connection.active_connection_id != Some(connection_id) {
        return false;
    }

    connection.active_connection_id = None;
    connection.command_tx = None;
    connection.close_tx = None;
    shared.connected.store(false, Ordering::Release);
    true
}

async fn handle_incoming_message(shared: &Arc<SharedState>, message: Message) -> bool {
    let payload = match message {
        Message::Text(text) => text.as_str().as_bytes().to_vec(),
        Message::Binary(bytes) => bytes.to_vec(),
        Message::Close(_) => return false,
        Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => return true,
    };

    let message: Value = match serde_json::from_slice(&payload) {
        Ok(message) => message,
        Err(_) => return true,
    };

    let Some(request_id) = response_id(&message) else {
        return true;
    };

    if message.get("method").is_some() {
        return true;
    }

    let pending_response_tx = {
        let mut pending = shared.pending.lock().await;
        pending.remove(&request_id)
    };

    let Some(pending_response_tx) = pending_response_tx else {
        return true;
    };

    if let Some(error_payload) = message.get("error") {
        let error_message = extract_error_message(error_payload);
        let _ = pending_response_tx.send(Err(anyhow!(error_message)));
        return true;
    }

    let result = message.get("result").cloned().unwrap_or(Value::Null);
    let _ = pending_response_tx.send(Ok(result));
    true
}

fn response_id(message: &Value) -> Option<String> {
    let id = message.get("id")?;
    match id {
        Value::String(id) => Some(id.clone()),
        Value::Number(id) => Some(id.to_string()),
        _ => None,
    }
}

fn extract_error_message(error_payload: &Value) -> String {
    if let Some(message) = error_payload.get("message").and_then(Value::as_str) {
        return message.to_owned();
    }

    error_payload.to_string()
}

async fn reject_pending_request(shared: &Arc<SharedState>, request_id: &str, reason: &str) {
    let pending_response_tx = {
        let mut pending = shared.pending.lock().await;
        pending.remove(request_id)
    };

    if let Some(pending_response_tx) = pending_response_tx {
        let _ = pending_response_tx.send(Err(anyhow!(reason.to_owned())));
    }
}

async fn reject_all_pending(shared: &Arc<SharedState>, reason: &str) {
    let pending_requests = {
        let mut pending = shared.pending.lock().await;
        pending
            .drain()
            .map(|(_, sender)| sender)
            .collect::<Vec<_>>()
    };

    let reason = reason.to_owned();
    for pending_response_tx in pending_requests {
        let _ = pending_response_tx.send(Err(anyhow!(reason.clone())));
    }
}

async fn remove_pending_request(
    shared: &Arc<SharedState>,
    request_id: &str,
) -> Option<oneshot::Sender<Result<Value>>> {
    let mut pending = shared.pending.lock().await;
    pending.remove(request_id)
}

async fn send_already_connected_error(websocket: &mut WebSocketStream<TcpStream>) {
    let payload = json!({
        "jsonrpc": "2.0",
        "error": {
            "code": -32001,
            "message": ALREADY_CONNECTED_ERROR,
        },
    });

    if let Ok(payload) = serde_json::to_string(&payload) {
        let _ = websocket.send(Message::Text(payload.into())).await;
    }
}

#[cfg(test)]
mod tests {
    use super::{ExtensionCommand, ExtensionServer, ExtensionServerConfig};
    use anyhow::{Result, anyhow, bail};
    use futures_util::{SinkExt, StreamExt};
    use serde_json::{Value, json};
    use tokio::time::{Duration, Instant, sleep, timeout};
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::Message;

    #[tokio::test]
    async fn send_command_returns_not_connected_error_when_extension_is_absent() -> Result<()> {
        let server = test_server(Duration::from_secs(1));
        server.start().await?;

        let command = ExtensionCommand::new("browser_tabs", json!({}));
        let response = server.send_command(command).await;

        server.stop().await?;

        let error = match response {
            Ok(_) => bail!("expected not-connected error"),
            Err(error) => error,
        };
        assert!(error.to_string().contains("Extension not connected"));
        Ok(())
    }

    #[tokio::test]
    async fn send_command_correlates_response_by_request_id() -> Result<()> {
        let server = test_server(Duration::from_secs(1));
        server.start().await?;

        let url = websocket_url(&server)?;
        let (mut client, _) = connect_async(url).await?;
        wait_until_connected(&server).await?;

        let client_task = tokio::spawn(async move {
            let first_message = client
                .next()
                .await
                .ok_or_else(|| anyhow!("client did not receive a command"))??;
            let payload = match first_message {
                Message::Text(text) => text,
                _ => bail!("client received non-text command"),
            };

            let request: Value = serde_json::from_str(&payload)?;
            let request_id = request
                .get("id")
                .cloned()
                .ok_or_else(|| anyhow!("request missing id"))?;

            let response = json!({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "ok": true,
                },
            });

            let response = serde_json::to_string(&response)?;
            client.send(Message::Text(response.into())).await?;
            client.close(None).await?;
            Result::<()>::Ok(())
        });

        let response = server
            .send_command(ExtensionCommand::new(
                "browser_snapshot",
                json!({ "tabId": 123 }),
            ))
            .await?;

        assert_eq!(response.request_method, "browser_snapshot");
        assert_eq!(response.payload.get("ok"), Some(&Value::Bool(true)));

        client_task
            .await
            .map_err(|error| anyhow!("client task join error: {error}"))??;

        server.stop().await?;
        Ok(())
    }

    #[tokio::test]
    async fn send_command_correlates_two_in_flight_requests_with_out_of_order_responses()
    -> Result<()> {
        let server = test_server(Duration::from_secs(1));
        server.start().await?;

        let url = websocket_url(&server)?;
        let (mut client, _) = connect_async(url).await?;
        wait_until_connected(&server).await?;

        let client_task = tokio::spawn(async move {
            let mut requests = Vec::with_capacity(2);

            while requests.len() < 2 {
                let command_message = client
                    .next()
                    .await
                    .ok_or_else(|| anyhow!("client did not receive command"))??;
                let payload = text_message_payload(command_message)?;
                let request: Value = serde_json::from_str(&payload)?;
                let request_id = request
                    .get("id")
                    .cloned()
                    .ok_or_else(|| anyhow!("request missing id"))?;
                let method = request
                    .get("method")
                    .and_then(Value::as_str)
                    .ok_or_else(|| anyhow!("request missing method"))?
                    .to_owned();
                requests.push((request_id, method));
            }

            let (_, second_method) = &requests[1];
            let second_response = json!({
                "jsonrpc": "2.0",
                "id": requests[1].0,
                "result": {
                    "echoMethod": second_method,
                },
            });
            client
                .send(Message::Text(
                    serde_json::to_string(&second_response)?.into(),
                ))
                .await?;

            let (_, first_method) = &requests[0];
            let first_response = json!({
                "jsonrpc": "2.0",
                "id": requests[0].0,
                "result": {
                    "echoMethod": first_method,
                },
            });
            client
                .send(Message::Text(
                    serde_json::to_string(&first_response)?.into(),
                ))
                .await?;

            client.close(None).await?;
            Result::<()>::Ok(())
        });

        let first = server.send_command(ExtensionCommand::new(
            "browser_tabs",
            json!({ "request": 1 }),
        ));
        let second = server.send_command(ExtensionCommand::new(
            "browser_snapshot",
            json!({ "request": 2 }),
        ));

        let (first_result, second_result) = tokio::join!(first, second);
        let first_result = first_result?;
        let second_result = second_result?;

        assert_eq!(first_result.request_method, "browser_tabs");
        assert_eq!(
            first_result.payload.get("echoMethod"),
            Some(&Value::String(String::from("browser_tabs")))
        );
        assert_eq!(second_result.request_method, "browser_snapshot");
        assert_eq!(
            second_result.payload.get("echoMethod"),
            Some(&Value::String(String::from("browser_snapshot")))
        );

        client_task
            .await
            .map_err(|error| anyhow!("client task join error: {error}"))??;

        server.stop().await?;
        Ok(())
    }

    #[tokio::test]
    async fn second_websocket_connection_is_rejected_and_first_remains_functional() -> Result<()> {
        let server = test_server(Duration::from_secs(1));
        server.start().await?;

        let url = websocket_url(&server)?;
        let (mut first_client, _) = connect_async(&url).await?;
        wait_until_connected(&server).await?;

        let (mut second_client, _) = connect_async(&url).await?;
        let second_message = timeout(Duration::from_secs(1), second_client.next())
            .await
            .map_err(|_| anyhow!("timed out waiting for rejection message"))?
            .ok_or_else(|| anyhow!("second client closed without rejection payload"))??;

        let second_payload = text_message_payload(second_message)?;
        let second_json: Value = serde_json::from_str(&second_payload)?;
        let error_code = second_json
            .get("error")
            .and_then(|error| error.get("code"))
            .and_then(Value::as_i64)
            .ok_or_else(|| anyhow!("second client rejection payload missing error.code"))?;
        assert_eq!(error_code, -32001);

        let first_task = tokio::spawn(async move {
            let command_message = first_client
                .next()
                .await
                .ok_or_else(|| anyhow!("first client did not receive command"))??;
            let payload = text_message_payload(command_message)?;
            let request: Value = serde_json::from_str(&payload)?;
            let request_id = request
                .get("id")
                .cloned()
                .ok_or_else(|| anyhow!("first client command missing id"))?;

            let response = json!({
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "ok": true,
                },
            });
            first_client
                .send(Message::Text(serde_json::to_string(&response)?.into()))
                .await?;
            first_client.close(None).await?;
            Result::<()>::Ok(())
        });

        let response = server
            .send_command(ExtensionCommand::new(
                "browser_interact",
                json!({ "action": "click" }),
            ))
            .await?;
        assert_eq!(response.request_method, "browser_interact");
        assert_eq!(response.payload.get("ok"), Some(&Value::Bool(true)));

        first_task
            .await
            .map_err(|error| anyhow!("first client task join error: {error}"))??;

        server.stop().await?;
        Ok(())
    }

    #[tokio::test]
    async fn send_command_returns_timeout_error_when_response_is_missing() -> Result<()> {
        let server = test_server(Duration::from_millis(60));
        server.start().await?;

        let url = websocket_url(&server)?;
        let (_client, _) = connect_async(url).await?;
        wait_until_connected(&server).await?;

        let result = server
            .send_command(ExtensionCommand::new(
                "browser_navigate",
                json!({ "url": "about:blank" }),
            ))
            .await;

        server.stop().await?;

        let error = match result {
            Ok(_) => bail!("expected timeout error"),
            Err(error) => error,
        };
        assert!(error.to_string().contains("request timeout"));
        Ok(())
    }

    fn test_server(command_timeout: Duration) -> ExtensionServer {
        let config = ExtensionServerConfig {
            host: String::from("127.0.0.1"),
            port: 0,
        };
        ExtensionServer::with_timeout(config, command_timeout)
    }

    fn websocket_url(server: &ExtensionServer) -> Result<String> {
        let bound_addr = server
            .bound_addr()
            .ok_or_else(|| anyhow!("websocket bridge is not bound"))?;
        Ok(format!("ws://{bound_addr}"))
    }

    async fn wait_until_connected(server: &ExtensionServer) -> Result<()> {
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if server.is_connected() {
                return Ok(());
            }
            sleep(Duration::from_millis(10)).await;
        }

        bail!("extension bridge did not become connected")
    }

    fn text_message_payload(message: Message) -> Result<String> {
        match message {
            Message::Text(text) => Ok(text.to_string()),
            _ => bail!("expected websocket text message"),
        }
    }
}
