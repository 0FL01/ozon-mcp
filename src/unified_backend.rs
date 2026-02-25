use crate::extension_server::ExtensionCommand;
use crate::ozon_handler::OzonHandler;
use crate::tool_catalog::{ToolCatalogEntry, all_tools, is_browser_tool, is_ozon_tool};
use crate::tool_result::ToolCallResult;
use crate::transport::Transport;
use anyhow::{Result, bail};
use serde_json::{Value, json};

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
