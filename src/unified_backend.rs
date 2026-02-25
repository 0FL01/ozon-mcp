use crate::browser_handler::{BrowserHandler, input_schema_for_tool};
use crate::ownership_arbiter::{OwnershipDecision, OwnershipMode};
use crate::ozon_handler::OzonHandler;
use crate::tool_catalog::{ToolCatalogEntry, all_tools, is_browser_tool, is_ozon_tool};
use crate::tool_result::ToolCallResult;
use crate::transport::Transport;
use anyhow::{Result, bail};
use rmcp::ServerHandler;
use rmcp::model::{
    CallToolRequestParams, CallToolResult, Content, ListToolsResult, PaginatedRequestParams,
    ServerCapabilities, ServerInfo, Tool,
};
use rmcp::service::{RequestContext, RoleServer};
use serde_json::{Value, json};
use std::path::Path;
use std::sync::Arc;
use std::sync::RwLock;
use std::sync::atomic::{AtomicBool, Ordering};

const OWNERSHIP_STATUS_TOOL_NAME: &str = "ozon_ownership_status";

#[derive(Debug, Clone)]
struct OwnershipStatusSnapshot {
    instance_id: String,
    mode: String,
    owner_instance_id: Option<String>,
    lease_file_path: String,
    last_reason: String,
}

impl OwnershipStatusSnapshot {
    fn new() -> Self {
        Self {
            instance_id: String::new(),
            mode: String::from("passive"),
            owner_instance_id: None,
            lease_file_path: String::new(),
            last_reason: String::from("uninitialized"),
        }
    }

    fn from_decision_mode(mode: OwnershipMode) -> String {
        match mode {
            OwnershipMode::Owner => String::from("owner"),
            OwnershipMode::Passive => String::from("passive"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct OwnershipStatusState {
    inner: Arc<RwLock<OwnershipStatusSnapshot>>,
}

impl OwnershipStatusState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(OwnershipStatusSnapshot::new())),
        }
    }

    pub fn initialize(&self, instance_id: &str, lease_file_path: &Path) {
        self.with_write(|snapshot| {
            snapshot.instance_id = instance_id.to_owned();
            snapshot.mode = String::from("passive");
            snapshot.owner_instance_id = None;
            snapshot.lease_file_path = lease_file_path.display().to_string();
            snapshot.last_reason = String::from("startup_not_reconciled_yet");
        });
    }

    pub fn apply_decision(&self, decision: &OwnershipDecision) {
        self.with_write(|snapshot| {
            snapshot.mode = OwnershipStatusSnapshot::from_decision_mode(decision.mode);
            snapshot.owner_instance_id = decision.owner_instance_id.clone();
            snapshot.last_reason = decision.reason.to_owned();
        });
    }

    pub fn mark_fail_closed(&self, reason: String) {
        self.with_write(|snapshot| {
            snapshot.mode = String::from("passive");
            snapshot.owner_instance_id = None;
            snapshot.last_reason = reason;
        });
    }

    pub fn payload(&self) -> Value {
        self.with_read(|snapshot| {
            json!({
                "instance_id": snapshot.instance_id.clone(),
                "mode": snapshot.mode.clone(),
                "owner_instance_id": snapshot.owner_instance_id.clone(),
                "lease_file_path": snapshot.lease_file_path.clone(),
                "last_reason": snapshot.last_reason.clone(),
            })
        })
    }

    fn with_read<R>(&self, reader: impl FnOnce(&OwnershipStatusSnapshot) -> R) -> R {
        match self.inner.read() {
            Ok(guard) => reader(&guard),
            Err(poisoned) => {
                let guard = poisoned.into_inner();
                reader(&guard)
            }
        }
    }

    fn with_write<R>(&self, writer: impl FnOnce(&mut OwnershipStatusSnapshot) -> R) -> R {
        match self.inner.write() {
            Ok(mut guard) => writer(&mut guard),
            Err(poisoned) => {
                let mut guard = poisoned.into_inner();
                writer(&mut guard)
            }
        }
    }
}

impl Default for OwnershipStatusState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct UnifiedBackend<T: Transport> {
    transport: T,
    ozon_handler: OzonHandler,
    tools_enabled: Arc<AtomicBool>,
    ownership_status: OwnershipStatusState,
}

impl<T: Transport> UnifiedBackend<T> {
    pub fn new(
        transport: T,
        tools_enabled: Arc<AtomicBool>,
        ownership_status: OwnershipStatusState,
    ) -> Self {
        Self {
            transport,
            ozon_handler: OzonHandler::new(),
            tools_enabled,
            ownership_status,
        }
    }

    pub fn list_tools(&self) -> Vec<ToolCatalogEntry> {
        if !self.are_tools_enabled() {
            return all_tools()
                .into_iter()
                .filter(|entry| entry.name == OWNERSHIP_STATUS_TOOL_NAME)
                .collect();
        }

        all_tools()
    }

    pub fn total_tool_count(&self) -> usize {
        all_tools().len()
    }

    fn are_tools_enabled(&self) -> bool {
        self.tools_enabled.load(Ordering::Acquire)
    }

    pub fn transport_name(&self) -> &'static str {
        self.transport.name()
    }

    fn tool_to_mcp(entry: ToolCatalogEntry) -> Tool {
        Tool::new(
            entry.name,
            entry.description,
            Arc::new(rmcp::model::object(input_schema_for_tool(entry.name))),
        )
    }

    fn find_tool(&self, name: &str) -> Option<Tool> {
        self.list_tools()
            .into_iter()
            .find(|entry| entry.name == name)
            .map(Self::tool_to_mcp)
    }

    pub async fn call_tool(&self, name: &str, args: Value) -> Result<ToolCallResult> {
        // NOTE: status tool is intentionally handled here (not in OzonHandler)
        // so it remains callable even when this instance is passive.
        if name == OWNERSHIP_STATUS_TOOL_NAME {
            let _ = args;
            return Ok(ToolCallResult {
                payload: self.ownership_status.payload(),
                is_error: false,
            });
        }

        if !self.are_tools_enabled() {
            bail!(
                "This ozon-mcp instance is passive. Another agent owns browser bridge lease right now."
            );
        }

        if is_ozon_tool(name) {
            return self
                .ozon_handler
                .handle_tool(&self.transport, name, args)
                .await;
        }

        if is_browser_tool(name) {
            return self.handle_browser_tool(name, args).await;
        }

        bail!("unknown tool: {name}");
    }

    async fn handle_browser_tool(&self, name: &str, args: Value) -> Result<ToolCallResult> {
        BrowserHandler::new(&self.transport)
            .handle_tool(name, args)
            .await
    }
}

impl<T: Transport + Send + Sync + 'static> ServerHandler for UnifiedBackend<T> {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: rmcp::model::ProtocolVersion::V_2024_11_05,
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: rmcp::model::Implementation {
                name: String::from("ozon-mcp"),
                version: String::from(env!("CARGO_PKG_VERSION")),
                title: Some(String::from("Ozon MCP Server")),
                description: Some(String::from(
                    "Rust MCP server for Ozon browser automation via Chrome extension bridge.",
                )),
                icons: None,
                website_url: None,
            },
            instructions: Some(String::from(
                "Connect Chrome extension before using browser_* tools.",
            )),
        }
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> std::result::Result<ListToolsResult, rmcp::ErrorData> {
        let tools = UnifiedBackend::list_tools(self)
            .into_iter()
            .map(Self::tool_to_mcp)
            .collect();
        Ok(ListToolsResult::with_all_items(tools))
    }

    fn get_tool(&self, name: &str) -> Option<Tool> {
        self.find_tool(name)
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> std::result::Result<CallToolResult, rmcp::ErrorData> {
        let name = request.name;
        let args = request
            .arguments
            .map(Value::Object)
            .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

        match UnifiedBackend::call_tool(self, name.as_ref(), args).await {
            Ok(result) => {
                if result.is_error {
                    Ok(CallToolResult::structured_error(result.payload))
                } else {
                    Ok(CallToolResult::structured(result.payload))
                }
            }
            Err(error) => Ok(CallToolResult::error(vec![Content::text(
                error.to_string(),
            )])),
        }
    }
}
