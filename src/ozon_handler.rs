use crate::tool_catalog::is_ozon_tool;
use crate::tool_result::ToolCallResult;
use anyhow::{Result, bail};
use serde_json::{Value, json};

#[derive(Debug, Default)]
pub struct OzonHandler;

impl OzonHandler {
    pub fn new() -> Self {
        Self
    }

    pub async fn handle_tool(&self, name: &str, args: Value) -> Result<ToolCallResult> {
        if !is_ozon_tool(name) {
            bail!("unknown ozon tool: {name}");
        }

        Ok(ToolCallResult {
            payload: json!({
                "status": "stub",
                "tool": name,
                "args": args,
                "message": "Ozon tool is not implemented in Rust iteration 1."
            }),
            is_error: false,
        })
    }
}
