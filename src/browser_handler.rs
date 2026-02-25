use crate::extension_server::ExtensionCommand;
use crate::tool_result::ToolCallResult;
use crate::transport::Transport;
use anyhow::{Context, Result, anyhow, bail};
use base64::Engine;
use serde_json::{Value, json};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::sleep;

pub struct BrowserHandler<'a, T: Transport> {
    transport: &'a T,
}

impl<'a, T: Transport> BrowserHandler<'a, T> {
    pub fn new(transport: &'a T) -> Self {
        Self { transport }
    }

    pub async fn handle_tool(&self, name: &str, args: Value) -> Result<ToolCallResult> {
        let raw_result = bool_arg(&args, "raw_result", false);
        let outcome = match name {
            "browser_tabs" => self.handle_tabs(&args, raw_result).await,
            "browser_navigate" => self.handle_navigate(&args, raw_result).await,
            "browser_evaluate" => self.handle_evaluate(&args, raw_result).await,
            "browser_take_screenshot" => self.handle_take_screenshot(&args, raw_result).await,
            "browser_handle_dialog" => self.handle_handle_dialog(&args, raw_result).await,
            "browser_interact" => self.handle_interact(&args, raw_result).await,
            _ => Ok(json!({
                "status": "stub",
                "tool": name,
                "args": args,
                "message": "Browser tool is not implemented in Rust iteration 1."
            })),
        };

        match outcome {
            Ok(payload) => Ok(ToolCallResult {
                payload,
                is_error: false,
            }),
            Err(error) => Ok(ToolCallResult {
                payload: json!({
                    "tool": name,
                    "error": error.to_string(),
                }),
                is_error: true,
            }),
        }
    }

    async fn handle_tabs(&self, args: &Value, raw_result: bool) -> Result<Value> {
        let action = string_arg(args, "action").ok_or_else(|| anyhow!("action is required"))?;

        match action {
            "list" => {
                let payload = self.send_command("getTabs", json!({})).await?;
                if raw_result {
                    return Ok(payload);
                }

                let tabs = payload
                    .get("tabs")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();

                Ok(json!({
                    "action": "list",
                    "tabs": tabs,
                    "total": tabs.len(),
                }))
            }
            "new" => {
                let url = string_arg(args, "url").unwrap_or("about:blank");
                let payload = self
                    .send_command(
                        "createTab",
                        json!({
                            "url": url,
                            "activate": bool_arg(args, "activate", true),
                            "stealth": bool_arg(args, "stealth", false),
                        }),
                    )
                    .await?;

                if raw_result {
                    return Ok(payload);
                }

                let tab = payload.get("tab").cloned().unwrap_or(Value::Null);
                let tab_id = tab.get("id").and_then(value_as_i64);
                let tab_index = self.tab_index_by_id(tab_id).await?;

                Ok(json!({
                    "action": "new",
                    "success": true,
                    "tab": tab,
                    "index": tab_index,
                }))
            }
            "attach" => {
                // Support both tabId (Chrome tab ID, e.g. 508892864) and index (tab position, e.g. 0, 1)
                let tab_index = if let Some(id) = int_arg(args, "tabId") {
                    // tabId provided - resolve to tabIndex
                    self.tab_index_by_id(Some(id))
                        .await?
                        .as_i64()
                        .ok_or_else(|| anyhow!("tabId {id} not found in open tabs"))?
                } else if let Some(idx) = int_arg(args, "index") {
                    // index provided directly
                    idx
                } else {
                    bail!(
                        "either 'index' (tab position) or 'tabId' (Chrome tab ID) is required for action=attach"
                    )
                };

                let payload = self
                    .send_command(
                        "selectTab",
                        json!({
                            "tabIndex": tab_index,
                            "activate": bool_arg(args, "activate", false),
                            "stealth": bool_arg(args, "stealth", false),
                        }),
                    )
                    .await?;

                if raw_result {
                    return Ok(payload);
                }

                Ok(json!({
                    "action": "attach",
                    "success": true,
                    "tab": payload.get("tab").cloned().unwrap_or(Value::Null),
                    "attached_index": tab_index,
                }))
            }
            "close" => {
                let index = int_arg(args, "index");
                let mut params = json!({});
                if let Some(index) = index {
                    params["index"] = json!(index);
                }
                let payload = self.send_command("closeTab", params).await?;

                if raw_result {
                    return Ok(payload);
                }

                Ok(json!({
                    "action": "close",
                    "success": payload.get("success").and_then(Value::as_bool).unwrap_or(true),
                    "closed_index": index,
                    "closed_attached_tab": payload
                        .get("closedAttachedTab")
                        .and_then(Value::as_bool)
                        .unwrap_or(false),
                }))
            }
            _ => bail!("unknown browser_tabs action: {action}"),
        }
    }

    async fn tab_index_by_id(&self, tab_id: Option<i64>) -> Result<Value> {
        let Some(tab_id) = tab_id else {
            return Ok(Value::Null);
        };

        let tabs_payload = self.send_command("getTabs", json!({})).await?;
        let tabs = tabs_payload
            .get("tabs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let index = tabs
            .iter()
            .find(|tab| tab.get("id").and_then(value_as_i64) == Some(tab_id))
            .and_then(|tab| tab.get("index").and_then(Value::as_i64))
            .map_or(Value::Null, Value::from);

        Ok(index)
    }

    async fn handle_navigate(&self, args: &Value, raw_result: bool) -> Result<Value> {
        let action = string_arg(args, "action").ok_or_else(|| anyhow!("action is required"))?;

        let payload = match action {
            "url" => {
                let url = string_arg(args, "url")
                    .ok_or_else(|| anyhow!("url is required for action=url"))?;
                self.send_cdp("Page.navigate", json!({ "url": url }))
                    .await?
            }
            "reload" => self.send_cdp("Page.reload", json!({})).await?,
            "back" => {
                self.send_cdp(
                    "Runtime.evaluate",
                    json!({
                        "expression": "window.history.back()",
                        "returnByValue": true,
                        "awaitPromise": true,
                    }),
                )
                .await?
            }
            "forward" => {
                self.send_cdp(
                    "Runtime.evaluate",
                    json!({
                        "expression": "window.history.forward()",
                        "returnByValue": true,
                        "awaitPromise": true,
                    }),
                )
                .await?
            }
            "test_page" => self.send_command("openTestPage", json!({})).await?,
            _ => bail!("unknown navigation action: {action}"),
        };

        if raw_result {
            return Ok(payload);
        }

        Ok(json!({
            "action": action,
            "success": true,
            "result": payload,
        }))
    }

    async fn handle_evaluate(&self, args: &Value, raw_result: bool) -> Result<Value> {
        let expression = if let Some(expression) = string_arg(args, "expression") {
            expression.to_owned()
        } else if let Some(function) = string_arg(args, "function") {
            format!("({function})()")
        } else {
            bail!("either expression or function is required")
        };

        let payload = self
            .send_cdp(
                "Runtime.evaluate",
                json!({
                    "expression": expression,
                    "returnByValue": true,
                    "awaitPromise": true,
                }),
            )
            .await?;

        if let Some(exception) = payload.get("exceptionDetails") {
            bail!("evaluation failed: {}", exception_message(exception));
        }

        if raw_result {
            return Ok(payload);
        }

        Ok(json!({
            "result": payload.get("result").and_then(|v| v.get("value")).cloned().unwrap_or(Value::Null),
            "type": payload.get("result").and_then(|v| v.get("type")).cloned().unwrap_or(Value::Null),
        }))
    }

    async fn handle_take_screenshot(&self, args: &Value, raw_result: bool) -> Result<Value> {
        let format = screenshot_format(args)?;
        let quality = screenshot_quality(args, &format)?;
        let full_page = bool_arg(args, "fullPage", false);

        let mut params = json!({
            "format": format,
            "captureBeyondViewport": full_page,
        });

        if let Some(quality) = quality {
            params["quality"] = json!(quality);
        }

        let payload = self.send_cdp("Page.captureScreenshot", params).await?;
        let data = payload
            .get("data")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("screenshot payload did not contain base64 data"))?
            .to_owned();
        let mime = if format == "png" {
            "image/png"
        } else {
            "image/jpeg"
        };

        let mut written_path = Value::Null;
        if let Some(path) = string_arg(args, "path") {
            let path = validate_screenshot_path(path)?;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&data)
                .context("failed to decode screenshot base64 payload")?;
            if let Some(parent) = path.parent()
                && !parent.as_os_str().is_empty()
            {
                let parent_path = parent.to_path_buf();
                let parent_display = parent.display().to_string();
                tokio::task::spawn_blocking(move || fs::create_dir_all(&parent_path))
                    .await
                    .context("screenshot directory creation task failed")?
                    .with_context(|| {
                        format!("failed to create screenshot directory: {parent_display}")
                    })?;
            }
            let output_path = path.clone();
            let output_display = path.display().to_string();
            tokio::task::spawn_blocking(move || fs::write(&output_path, &bytes))
                .await
                .context("screenshot write task failed")?
                .with_context(|| format!("failed to write screenshot file: {output_display}"))?;
            written_path = Value::String(path.to_string_lossy().into_owned());
        }

        if raw_result {
            return Ok(json!({
                "mime": mime,
                "data": data,
                "path": written_path,
                "raw": payload,
            }));
        }

        Ok(json!({
            "mime": mime,
            "data": data,
            "path": written_path,
        }))
    }

    async fn handle_handle_dialog(&self, args: &Value, raw_result: bool) -> Result<Value> {
        let accept = bool_arg(args, "accept", true);
        let text = string_arg(args, "text").unwrap_or_default();
        let payload = self
            .send_cdp(
                "Page.handleJavaScriptDialog",
                json!({
                    "accept": accept,
                    "promptText": text,
                }),
            )
            .await?;

        if raw_result {
            return Ok(payload);
        }

        Ok(json!({
            "success": payload.get("success").and_then(Value::as_bool).unwrap_or(true),
            "accept": accept,
            "text": text,
        }))
    }

    async fn handle_interact(&self, args: &Value, raw_result: bool) -> Result<Value> {
        let actions = args
            .get("actions")
            .and_then(Value::as_array)
            .ok_or_else(|| anyhow!("actions array is required"))?;
        let on_error = string_arg(args, "onError").unwrap_or("stop");
        if on_error != "stop" && on_error != "ignore" {
            bail!("onError must be either \"stop\" or \"ignore\"");
        }

        let mut results = Vec::with_capacity(actions.len());
        let mut failures = 0usize;

        for (idx, action) in actions.iter().enumerate() {
            let run_result = self.run_interaction_action(action).await;
            match run_result {
                Ok(result) => results.push(json!({
                    "index": idx,
                    "ok": true,
                    "result": result,
                })),
                Err(error) => {
                    failures += 1;
                    if on_error == "stop" {
                        bail!("interaction action {idx} failed: {error}");
                    }

                    results.push(json!({
                        "index": idx,
                        "ok": false,
                        "error": error.to_string(),
                    }));
                }
            }
        }

        if raw_result {
            return Ok(json!({
                "success": failures == 0,
                "onError": on_error,
                "results": results,
            }));
        }

        Ok(json!({
            "success": failures == 0,
            "performed": results.len(),
            "failed": failures,
            "results": results,
        }))
    }

    async fn run_interaction_action(&self, action: &Value) -> Result<Value> {
        let action_type = string_arg(action, "type")
            .ok_or_else(|| anyhow!("interaction action.type is required"))?;

        match action_type {
            "click" => self.interact_click(action).await,
            "type" => self.interact_type(action).await,
            "clear" => self.interact_clear(action).await,
            "press_key" => self.interact_press_key(action).await,
            "wait" => self.interact_wait(action).await,
            "scroll_by" => self.interact_scroll_by(action).await,
            "scroll_into_view" => self.interact_scroll_into_view(action).await,
            "hover" => self.interact_hover(action).await,
            _ => bail!("unsupported interaction type: {action_type}"),
        }
    }

    async fn interact_click(&self, action: &Value) -> Result<Value> {
        let point = self.action_point(action, true).await?;
        let button = mouse_button(action);
        let click_count = positive_i64_arg(action, "clickCount").unwrap_or(1);

        self.dispatch_mouse_event(MouseEventDispatch {
            event_type: "mouseMoved",
            x: point.x,
            y: point.y,
            button: button.as_str(),
            click_count: 0,
        })
        .await?;
        self.dispatch_mouse_event(MouseEventDispatch {
            event_type: "mousePressed",
            x: point.x,
            y: point.y,
            button: button.as_str(),
            click_count,
        })
        .await?;
        let released = self
            .dispatch_mouse_event(MouseEventDispatch {
                event_type: "mouseReleased",
                x: point.x,
                y: point.y,
                button: button.as_str(),
                click_count,
            })
            .await?;

        Ok(json!({
            "type": "click",
            "x": point.x,
            "y": point.y,
            "button": button,
            "result": released,
        }))
    }

    async fn interact_type(&self, action: &Value) -> Result<Value> {
        let text = string_arg(action, "text").ok_or_else(|| anyhow!("text is required"))?;
        if let Some(selector) = string_arg(action, "selector") {
            self.focus_selector(selector).await?;
        }

        for (idx, ch) in text.chars().enumerate() {
            self.dispatch_key_char(ch).await?;
            sleep(typing_delay(idx, ch)).await;
        }

        Ok(json!({
            "type": "type",
            "typed": text.len(),
        }))
    }

    async fn interact_clear(&self, action: &Value) -> Result<Value> {
        let selector = string_arg(action, "selector")
            .ok_or_else(|| anyhow!("selector is required for clear action"))?;
        let selector_json = serde_json::to_string(selector).context("failed to encode selector")?;
        let expression = format!(
            "(() => {{
                const el = document.querySelector({selector_json});
                if (!el) {{
                    return {{ success: false, error: 'Element not found' }};
                }}
                el.focus();
                if ('value' in el) {{
                    el.value = '';
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return {{ success: true }};
                }}
                return {{ success: false, error: 'Element does not support value clear' }};
            }})()"
        );

        let value = self.evaluate_value(&expression).await?;
        let success = value
            .get("success")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        if !success {
            let reason = value
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("clear action failed");
            bail!(reason.to_owned());
        }

        Ok(json!({ "type": "clear", "selector": selector }))
    }

    async fn interact_press_key(&self, action: &Value) -> Result<Value> {
        let key = string_arg(action, "key").ok_or_else(|| anyhow!("key is required"))?;
        let text = if key.chars().count() == 1 {
            Some(key.to_owned())
        } else {
            None
        };

        self.dispatch_key_event("keyDown", key, text.as_deref())
            .await?;
        self.dispatch_key_event("keyUp", key, text.as_deref())
            .await?;

        Ok(json!({
            "type": "press_key",
            "key": key,
        }))
    }

    async fn interact_wait(&self, action: &Value) -> Result<Value> {
        let timeout_ms = positive_u64_arg(action, "timeout").unwrap_or(500);
        sleep(Duration::from_millis(timeout_ms)).await;
        Ok(json!({
            "type": "wait",
            "timeout": timeout_ms,
        }))
    }

    async fn interact_scroll_by(&self, action: &Value) -> Result<Value> {
        let delta_x = number_arg(action, "x").unwrap_or(0.0);
        let delta_y = number_arg(action, "y").unwrap_or(300.0);
        let point = if let Some(selector) = string_arg(action, "selector") {
            self.resolve_selector_center(selector, false).await?
        } else {
            self.viewport_center().await?
        };

        let result = self
            .send_cdp(
                "Input.dispatchMouseEvent",
                json!({
                    "type": "mouseWheel",
                    "x": point.x,
                    "y": point.y,
                    "deltaX": delta_x,
                    "deltaY": delta_y,
                }),
            )
            .await?;

        ensure_command_success(&result, "scroll_by failed")?;

        Ok(json!({
            "type": "scroll_by",
            "deltaX": delta_x,
            "deltaY": delta_y,
            "x": point.x,
            "y": point.y,
        }))
    }

    async fn interact_scroll_into_view(&self, action: &Value) -> Result<Value> {
        let selector = string_arg(action, "selector")
            .ok_or_else(|| anyhow!("selector is required for scroll_into_view"))?;
        let selector_json = serde_json::to_string(selector).context("failed to encode selector")?;
        let expression = format!(
            "(() => {{
                const el = document.querySelector({selector_json});
                if (!el) {{
                    return {{ success: false, error: 'Element not found' }};
                }}
                el.scrollIntoView({{ block: 'center', inline: 'center', behavior: 'auto' }});
                const rect = el.getBoundingClientRect();
                return {{
                    success: true,
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                }};
            }})()"
        );

        let value = self.evaluate_value(&expression).await?;
        let success = value
            .get("success")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        if !success {
            let reason = value
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("scroll_into_view failed");
            bail!(reason.to_owned());
        }

        Ok(json!({
            "type": "scroll_into_view",
            "selector": selector,
            "x": value.get("x").and_then(Value::as_f64).unwrap_or(0.0),
            "y": value.get("y").and_then(Value::as_f64).unwrap_or(0.0),
        }))
    }

    async fn interact_hover(&self, action: &Value) -> Result<Value> {
        let point = self.action_point(action, false).await?;
        self.dispatch_mouse_event(MouseEventDispatch {
            event_type: "mouseMoved",
            x: point.x,
            y: point.y,
            button: "left",
            click_count: 0,
        })
        .await?;

        Ok(json!({
            "type": "hover",
            "x": point.x,
            "y": point.y,
        }))
    }

    async fn action_point(&self, action: &Value, scroll: bool) -> Result<Point> {
        if let Some(selector) = string_arg(action, "selector") {
            return self.resolve_selector_center(selector, scroll).await;
        }

        let x = number_arg(action, "x");
        let y = number_arg(action, "y");

        match (x, y) {
            (Some(x), Some(y)) => Ok(Point { x, y }),
            _ => bail!("selector or x+y coordinates are required"),
        }
    }

    async fn resolve_selector_center(&self, selector: &str, scroll: bool) -> Result<Point> {
        let selector_json = serde_json::to_string(selector).context("failed to encode selector")?;
        let expression = if scroll {
            format!(
                "(() => {{
                    const el = document.querySelector({selector_json});
                    if (!el) {{
                        return {{ success: false, error: 'Element not found' }};
                    }}
                    el.scrollIntoView({{ block: 'center', inline: 'center', behavior: 'auto' }});
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || rect.width === 0 || rect.height === 0) {{
                        return {{ success: false, error: 'Element is not visible' }};
                    }}
                    return {{
                        success: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    }};
                }})()"
            )
        } else {
            format!(
                "(() => {{
                    const el = document.querySelector({selector_json});
                    if (!el) {{
                        return {{ success: false, error: 'Element not found' }};
                    }}
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || rect.width === 0 || rect.height === 0) {{
                        return {{ success: false, error: 'Element is not visible' }};
                    }}
                    return {{
                        success: true,
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    }};
                }})()"
            )
        };

        let value = self.evaluate_value(&expression).await?;
        let success = value
            .get("success")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        if !success {
            let reason = value
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("failed to resolve selector");
            bail!(format!("{reason}: {selector}"));
        }

        let x = value
            .get("x")
            .and_then(Value::as_f64)
            .ok_or_else(|| anyhow!("resolved selector is missing x coordinate"))?;
        let y = value
            .get("y")
            .and_then(Value::as_f64)
            .ok_or_else(|| anyhow!("resolved selector is missing y coordinate"))?;

        Ok(Point { x, y })
    }

    async fn viewport_center(&self) -> Result<Point> {
        let value = self
            .evaluate_value(
                "({ x: Math.max(0, window.innerWidth / 2), y: Math.max(0, window.innerHeight / 2) })",
            )
            .await?;

        let x = value
            .get("x")
            .and_then(Value::as_f64)
            .ok_or_else(|| anyhow!("failed to compute viewport center x"))?;
        let y = value
            .get("y")
            .and_then(Value::as_f64)
            .ok_or_else(|| anyhow!("failed to compute viewport center y"))?;

        Ok(Point { x, y })
    }

    async fn focus_selector(&self, selector: &str) -> Result<()> {
        let selector_json = serde_json::to_string(selector).context("failed to encode selector")?;
        let expression = format!(
            "(() => {{
                const el = document.querySelector({selector_json});
                if (!el) {{
                    return {{ success: false, error: 'Element not found' }};
                }}
                el.focus();
                return {{ success: true }};
            }})()"
        );
        let value = self.evaluate_value(&expression).await?;
        let success = value
            .get("success")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        if success {
            Ok(())
        } else {
            let reason = value
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("failed to focus selector");
            bail!(format!("{reason}: {selector}"));
        }
    }

    async fn evaluate_value(&self, expression: &str) -> Result<Value> {
        let payload = self
            .send_cdp(
                "Runtime.evaluate",
                json!({
                    "expression": expression,
                    "returnByValue": true,
                    "awaitPromise": true,
                }),
            )
            .await?;

        if let Some(exception) = payload.get("exceptionDetails") {
            bail!(
                "runtime evaluation failed: {}",
                exception_message(exception)
            );
        }

        Ok(payload
            .get("result")
            .and_then(|v| v.get("value"))
            .cloned()
            .unwrap_or(Value::Null))
    }

    async fn dispatch_mouse_event(&self, options: MouseEventDispatch<'_>) -> Result<Value> {
        let result = self
            .send_cdp(
                "Input.dispatchMouseEvent",
                json!({
                    "type": options.event_type,
                    "x": options.x,
                    "y": options.y,
                    "button": options.button,
                    "clickCount": options.click_count,
                }),
            )
            .await?;
        ensure_command_success(&result, "mouse event failed")?;
        Ok(result)
    }

    async fn dispatch_key_char(&self, ch: char) -> Result<()> {
        let text = ch.to_string();
        let result = self
            .send_cdp(
                "Input.dispatchKeyEvent",
                json!({
                    "type": "char",
                    "text": text,
                    "unmodifiedText": ch.to_string(),
                    "key": ch.to_string(),
                }),
            )
            .await?;
        ensure_command_success(&result, "typing failed")
    }

    async fn dispatch_key_event(
        &self,
        event_type: &str,
        key: &str,
        text: Option<&str>,
    ) -> Result<()> {
        let mut params = json!({
            "type": event_type,
            "key": key,
        });
        if let Some(text) = text {
            params["text"] = json!(text);
            params["unmodifiedText"] = json!(text);
        }

        let result = self.send_cdp("Input.dispatchKeyEvent", params).await?;
        ensure_command_success(&result, "key dispatch failed")
    }

    async fn send_cdp(&self, method: &str, params: Value) -> Result<Value> {
        self.send_command(
            "forwardCDPCommand",
            json!({
                "method": method,
                "params": params,
            }),
        )
        .await
    }

    async fn send_command(&self, method: &str, params: Value) -> Result<Value> {
        let response = self
            .transport
            .send_command(ExtensionCommand::new(method, params))
            .await
            .with_context(|| format!("extension command failed: {method}"))?;
        Ok(response.payload)
    }
}

#[derive(Debug, Clone, Copy)]
struct Point {
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, Copy)]
struct MouseEventDispatch<'a> {
    event_type: &'a str,
    x: f64,
    y: f64,
    button: &'a str,
    click_count: i64,
}

fn bool_arg(args: &Value, key: &str, default: bool) -> bool {
    args.get(key).and_then(Value::as_bool).unwrap_or(default)
}

fn string_arg<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args.get(key).and_then(Value::as_str)
}

fn int_arg(args: &Value, key: &str) -> Option<i64> {
    let raw = args.get(key)?;
    value_as_i64(raw).or_else(|| raw.as_str()?.parse::<i64>().ok())
}

fn value_as_i64(raw: &Value) -> Option<i64> {
    if let Some(value) = raw.as_i64() {
        return Some(value);
    }

    if let Some(value) = raw.as_u64() {
        return i64::try_from(value).ok();
    }

    None
}

fn positive_i64_arg(args: &Value, key: &str) -> Option<i64> {
    let value = int_arg(args, key)?;
    if value < 0 { None } else { Some(value) }
}

fn positive_u64_arg(args: &Value, key: &str) -> Option<u64> {
    let value = args.get(key)?;
    if let Some(as_u64) = value.as_u64() {
        return Some(as_u64);
    }

    if let Some(as_i64) = value.as_i64() {
        return u64::try_from(as_i64).ok();
    }

    if let Some(as_f64) = value.as_f64()
        && as_f64.is_finite()
        && as_f64 >= 0.0
    {
        return Some(as_f64.round() as u64);
    }

    value.as_str()?.parse::<u64>().ok()
}

fn number_arg(args: &Value, key: &str) -> Option<f64> {
    let raw = args.get(key)?;
    if let Some(value) = raw.as_f64() {
        return Some(value);
    }

    raw.as_str()?.parse::<f64>().ok()
}

fn mouse_button(action: &Value) -> String {
    match string_arg(action, "button") {
        Some("right") => String::from("right"),
        Some("middle") => String::from("middle"),
        _ => String::from("left"),
    }
}

fn screenshot_format(args: &Value) -> Result<String> {
    let format = string_arg(args, "type").unwrap_or("jpeg").to_lowercase();
    if format == "png" || format == "jpeg" {
        Ok(format)
    } else {
        bail!("unsupported screenshot type: {format}")
    }
}

fn screenshot_quality(args: &Value, format: &str) -> Result<Option<u8>> {
    if format == "png" {
        return Ok(None);
    }

    let quality_value = if let Some(value) = args.get("quality") {
        value
    } else {
        return Ok(Some(80));
    };

    if let Some(as_u64) = quality_value.as_u64() {
        let quality =
            u8::try_from(as_u64).map_err(|_| anyhow!("quality must be in range 0..=100"))?;
        if quality > 100 {
            bail!("quality must be in range 0..=100");
        }
        return Ok(Some(quality));
    }

    if let Some(as_i64) = quality_value.as_i64() {
        let quality =
            u8::try_from(as_i64).map_err(|_| anyhow!("quality must be in range 0..=100"))?;
        if quality > 100 {
            bail!("quality must be in range 0..=100");
        }
        return Ok(Some(quality));
    }

    if let Some(as_f64) = quality_value.as_f64() {
        if !as_f64.is_finite() || !(0.0..=100.0).contains(&as_f64) {
            bail!("quality must be in range 0..=100");
        }
        return Ok(Some(as_f64.round() as u8));
    }

    if let Some(as_str) = quality_value.as_str() {
        let parsed = as_str
            .parse::<u8>()
            .map_err(|_| anyhow!("quality must be an integer in range 0..=100"))?;
        if parsed > 100 {
            bail!("quality must be in range 0..=100");
        }
        return Ok(Some(parsed));
    }

    bail!("quality must be a number")
}

fn validate_screenshot_path(path: &str) -> Result<PathBuf> {
    if path.trim().is_empty() {
        bail!("screenshot path must not be empty");
    }

    let candidate = Path::new(path);
    if candidate.is_absolute() {
        bail!("screenshot path must be relative");
    }

    if candidate
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        bail!("screenshot path must not contain '..'");
    }

    Ok(candidate.to_path_buf())
}

fn ensure_command_success(result: &Value, default_message: &str) -> Result<()> {
    if result.get("success").and_then(Value::as_bool) == Some(false) {
        let message = result
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or(default_message);
        bail!(message.to_owned());
    }

    Ok(())
}

fn exception_message(exception: &Value) -> String {
    if let Some(text) = exception.get("text").and_then(Value::as_str) {
        return text.to_owned();
    }

    if let Some(description) = exception
        .get("exception")
        .and_then(|v| v.get("description"))
        .and_then(Value::as_str)
    {
        return description.to_owned();
    }

    exception.to_string()
}

fn typing_delay(index: usize, ch: char) -> Duration {
    let base_ms = 18_u64;
    let now_nanos = match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => u64::from(duration.subsec_nanos()),
        Err(_) => 0,
    };
    let char_value = u64::from(ch as u32);
    let index_value = u64::try_from(index).unwrap_or(0);
    let jitter = (now_nanos + char_value + index_value.saturating_mul(7)) % 24;
    Duration::from_millis(base_ms + jitter)
}

pub fn input_schema_for_tool(name: &str) -> Value {
    match name {
        "browser_tabs" => json!({
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["list", "new", "attach", "close"],
                    "description": "list: show all tabs, new: create tab, attach: select tab for automation, close: close tab"
                },
                "url": {
                    "type": "string",
                    "description": "URL for 'new' action. Optional, defaults to about:blank"
                },
                "index": {
                    "type": "number",
                    "description": "Tab position index (0-based) for attach/close. Use this OR tabId"
                },
                "tabId": {
                    "type": "number",
                    "description": "Chrome tab ID (from list) for attach. Use this OR index. Preferred when you have the tab object from list"
                },
                "activate": {
                    "type": "boolean",
                    "description": "Whether to focus the tab (bring to front)"
                },
                "stealth": {
                    "type": "boolean",
                    "description": "Enable stealth mode to hide automation"
                },
                "raw_result": {
                    "type": "boolean",
                    "description": "Return raw extension response"
                }
            },
            "required": ["action"],
            "allOf": [
                {
                    "if": {
                        "properties": {
                            "action": {
                                "const": "attach"
                            }
                        }
                    },
                    "then": {
                        "anyOf": [
                            {"required": ["index"]},
                            {"required": ["tabId"]}
                        ]
                    }
                }
            ]
        }),
        "browser_navigate" => json!({
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["url", "back", "forward", "reload", "test_page"],
                },
                "url": {
                    "type": "string",
                },
                "raw_result": {
                    "type": "boolean",
                }
            },
            "required": ["action"]
        }),
        "browser_interact" => json!({
            "type": "object",
            "properties": {
                "actions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["click", "type", "clear", "press_key", "hover", "wait", "scroll_by", "scroll_into_view"],
                            },
                            "selector": {
                                "type": "string",
                            },
                            "text": {
                                "type": "string",
                            },
                            "key": {
                                "type": "string",
                            },
                            "x": {
                                "type": "number",
                            },
                            "y": {
                                "type": "number",
                            },
                            "button": {
                                "type": "string",
                                "enum": ["left", "right", "middle"],
                            },
                            "clickCount": {
                                "type": "number",
                            },
                            "timeout": {
                                "type": "number",
                            }
                        },
                        "required": ["type"]
                    }
                },
                "onError": {
                    "type": "string",
                    "enum": ["stop", "ignore"],
                },
                "raw_result": {
                    "type": "boolean",
                }
            },
            "required": ["actions"]
        }),
        "browser_take_screenshot" => json!({
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["png", "jpeg"],
                },
                "quality": {
                    "type": "number",
                },
                "fullPage": {
                    "type": "boolean",
                },
                "path": {
                    "type": "string",
                },
                "raw_result": {
                    "type": "boolean",
                }
            }
        }),
        "browser_evaluate" => json!({
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                },
                "function": {
                    "type": "string",
                },
                "raw_result": {
                    "type": "boolean",
                }
            },
            "anyOf": [
                {
                    "required": ["expression"]
                },
                {
                    "required": ["function"]
                }
            ]
        }),
        "browser_handle_dialog" => json!({
            "type": "object",
            "properties": {
                "accept": {
                    "type": "boolean",
                },
                "text": {
                    "type": "string",
                },
                "raw_result": {
                    "type": "boolean",
                }
            }
        }),
        "ozon_search_and_parse" => json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "minLength": 1,
                }
            },
            "required": ["query"],
        }),
        "ozon_parse_product_page" => json!({
            "type": "object",
            "properties": {},
        }),
        "ozon_cart_action" => json!({
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["add", "increment", "decrement"],
                },
                "quantity": {
                    "type": "number",
                }
            },
            "required": ["action"],
        }),
        "ozon_get_share_link" => json!({
            "type": "object",
            "properties": {},
        }),
        "ozon_ownership_status" => json!({
            "type": "object",
            "properties": {},
        }),
        // DISABLED: ozon_apply_filter schema
        // Reason: Filter application requires complex React event simulation
        // Ozon uses virtual scrolling and session-validated URLs
        // Attempted implementations:
        // 1. DOM click approach - fails due to virtual list (items not in DOM)
        // 2. URL manipulation approach - fails due to session validation
        // 3. Proper solution requires: React devtools integration or CDP Runtime.evaluate
        //    with React-specific event dispatch and state synchronization
        // "ozon_apply_filter" => json!({
        //     "type": "object",
        //     "properties": {
        //         "filter_type": {
        //             "type": "string",
        //             "enum": ["brand", "price_min", "price_max", "sort"],
        //             "description": "Type of filter to apply",
        //         },
        //         "value": {
        //             "type": "string",
        //             "description": "Filter value (brand name, price, or sort option)",
        //         }
        //     },
        //     "required": ["filter_type", "value"],
        // }),
        _ => json!({
            "type": "object",
            "properties": {},
        }),
    }
}
