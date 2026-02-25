use serde_json::Value;

#[derive(Debug, Clone)]
pub struct ToolCallResult {
    pub payload: Value,
    pub is_error: bool,
}
