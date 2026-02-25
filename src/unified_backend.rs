use crate::extension_server::ExtensionCommand;
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
use std::sync::Arc;

pub struct UnifiedBackend<T: Transport> {
    transport: T,
    ozon_handler: OzonHandler,
}

impl<T: Transport> UnifiedBackend<T> {
    pub fn new(transport: T) -> Self {
        Self {
            transport,
            ozon_handler: OzonHandler::new(),
        }
    }

    pub fn list_tools(&self) -> Vec<ToolCatalogEntry> {
        all_tools()
    }

    pub fn transport_name(&self) -> &'static str {
        self.transport.name()
    }

    fn tool_to_mcp(entry: ToolCatalogEntry) -> Tool {
        Tool::new(
            entry.name,
            entry.description,
            Arc::new(rmcp::model::object(json!({
                "type": "object",
                "properties": {},
            }))),
        )
    }

    fn find_tool(&self, name: &str) -> Option<Tool> {
        self.list_tools()
            .into_iter()
            .find(|entry| entry.name == name)
            .map(Self::tool_to_mcp)
    }

    pub async fn call_tool(&self, name: &str, args: Value) -> Result<ToolCallResult> {
        if is_ozon_tool(name) {
            return self.ozon_handler.handle_tool(name, args).await;
        }

        if is_browser_tool(name) {
            return self.handle_browser_tool(name, args).await;
        }

        bail!("unknown tool: {name}");
    }

    async fn handle_browser_tool(&self, name: &str, args: Value) -> Result<ToolCallResult> {
        let command = ExtensionCommand::new(
            "migration/not_implemented",
            json!({
                "tool": name,
                "args": args,
            }),
        );

        let response = self.transport.send_command(command).await?;

        Ok(ToolCallResult {
            payload: json!({
                "status": "stub",
                "tool": name,
                "bridgeMethod": response.request_method,
                "bridgePayload": response.payload,
                "message": "Browser tool is not implemented in Rust iteration 1."
            }),
            is_error: false,
        })
    }
}

impl<T: Transport + Send + Sync + 'static> ServerHandler for UnifiedBackend<T> {
    fn get_info(&self) -> ServerInfo {
        let mut info = ServerInfo::default();
        info.server_info.name = String::from("ozon-mcp");
        info.server_info.description = Some(String::from(
            "Rust MCP server for Ozon browser automation via Chrome extension bridge.",
        ));
        info.capabilities = ServerCapabilities::builder().enable_tools().build();
        info.instructions = Some(String::from(
            "Connect the Chrome extension before using browser_* tools.",
        ));
        info
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
