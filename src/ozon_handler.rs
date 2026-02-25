use crate::browser_handler::BrowserHandler;
use crate::tool_catalog::is_ozon_tool;
use crate::tool_result::ToolCallResult;
use crate::transport::Transport;
use anyhow::{Context, Result, anyhow, bail};
use serde_json::{Value, json};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::sleep;
use url::Url;

#[derive(Debug, Clone)]
pub struct OzonHandler {
    selectors: Value,
}

impl Default for OzonHandler {
    fn default() -> Self {
        Self::new()
    }
}

impl OzonHandler {
    pub fn new() -> Self {
        let raw = include_str!("../selectors/ozon-selectors.json");
        let selectors = serde_json::from_str(raw).unwrap_or_else(|_| json!({}));
        Self { selectors }
    }

    pub async fn handle_tool<T: Transport>(
        &self,
        transport: &T,
        name: &str,
        args: Value,
    ) -> Result<ToolCallResult> {
        if !is_ozon_tool(name) {
            bail!("unknown ozon tool: {name}");
        }

        let outcome = match name {
            "ozon_search_and_parse" => self.handle_search_and_parse(transport, &args).await,
            "ozon_parse_product_page" => self.handle_parse_product_page(transport).await,
            "ozon_cart_action" => self.handle_cart_action(transport, &args).await,
            "ozon_get_share_link" => self.handle_get_share_link(transport).await,
            _ => Err(anyhow!("unknown ozon tool: {name}")),
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

    fn selector(&self, path: &str) -> Option<&str> {
        let mut current = &self.selectors;
        for part in path.split('.') {
            current = current.get(part)?;
        }
        current.as_str()
    }

    fn now_nanos() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_else(|_| Duration::from_secs(0))
            .as_nanos()
    }

    fn pseudo_random_range_ms(min_ms: u64, max_ms: u64) -> u64 {
        if min_ms >= max_ms {
            return min_ms;
        }
        let span = max_ms - min_ms;
        let v = (Self::now_nanos() % (span as u128 + 1)) as u64;
        min_ms + v
    }

    async fn random_wait(&self, min_ms: u64, max_ms: u64) {
        let delay = Self::pseudo_random_range_ms(min_ms, max_ms);
        sleep(Duration::from_millis(delay)).await;
    }

    async fn browser_call<T: Transport>(
        &self,
        transport: &T,
        tool: &str,
        args: Value,
    ) -> Result<Value> {
        let browser = BrowserHandler::new(transport);
        let result = browser
            .handle_tool(tool, args)
            .await
            .with_context(|| format!("browser tool call failed: {tool}"))?;
        if result.is_error {
            bail!(
                "browser tool returned error for {tool}: {}",
                result
                    .payload
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
            );
        }
        Ok(result.payload)
    }

    async fn eval_value<T: Transport>(&self, transport: &T, expression: &str) -> Result<Value> {
        let payload = self
            .browser_call(
                transport,
                "browser_evaluate",
                json!({
                    "expression": expression,
                    "raw_result": false,
                }),
            )
            .await?;
        Ok(payload.get("result").cloned().unwrap_or(Value::Null))
    }

    fn js_string(value: &str) -> Result<String> {
        serde_json::to_string(value).context("failed to encode JS string")
    }

    fn is_ozon_url(url: &str) -> bool {
        let parsed = match Url::parse(url) {
            Ok(parsed) => parsed,
            Err(_) => return false,
        };
        let host = match parsed.host_str() {
            Some(host) => host,
            None => return false,
        };
        host == "ozon.ru" || host.ends_with(".ozon.ru")
    }

    async fn ensure_attached<T: Transport>(&self, transport: &T) -> Result<()> {
        let tabs_payload = self
            .browser_call(
                transport,
                "browser_tabs",
                json!({
                    "action": "list",
                    "raw_result": true,
                }),
            )
            .await?;

        let tabs = tabs_payload
            .get("tabs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let mut candidate: Option<i64> = None;
        for tab in &tabs {
            let automatable = tab
                .get("automatable")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if !automatable {
                continue;
            }
            let url = tab.get("url").and_then(Value::as_str).unwrap_or("");
            let index = tab.get("index").and_then(Value::as_i64);
            if index.is_none() {
                continue;
            }
            if Self::is_ozon_url(url) {
                candidate = index;
                break;
            }
        }

        if let Some(index) = candidate {
            self.browser_call(
                transport,
                "browser_tabs",
                json!({
                    "action": "attach",
                    "index": index,
                    "activate": false,
                    "stealth": true,
                }),
            )
            .await?;
            return Ok(());
        }

        self.browser_call(
            transport,
            "browser_tabs",
            json!({
                "action": "new",
                "url": "https://www.ozon.ru/",
                "activate": true,
                "stealth": true,
            }),
        )
        .await?;

        Ok(())
    }

    async fn wait_for_any_selector<T: Transport>(
        &self,
        transport: &T,
        selectors: &[&str],
        timeout: Duration,
    ) -> Result<()> {
        let start = SystemTime::now();
        loop {
            for selector in selectors {
                let sel = Self::js_string(selector)?;
                let present = self
                    .eval_value(
                        transport,
                        &format!("(() => !!document.querySelector({sel}))()"),
                    )
                    .await?;
                if present.as_bool().unwrap_or(false) {
                    return Ok(());
                }
            }

            if start.elapsed().unwrap_or_else(|_| Duration::from_secs(0)) >= timeout {
                bail!("timeout waiting for selector(s)");
            }

            sleep(Duration::from_millis(250)).await;
        }
    }

    async fn handle_search_and_parse<T: Transport>(
        &self,
        transport: &T,
        args: &Value,
    ) -> Result<Value> {
        let query = args
            .get("query")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .ok_or_else(|| anyhow!("query is required"))?;

        self.ensure_attached(transport).await?;

        let search_input = self
            .selector("search.input")
            .ok_or_else(|| anyhow!("missing selector: search.input"))?;
        let results_grid = self
            .selector("search.results.grid")
            .unwrap_or("[data-widget='tileGridDesktop']");
        let results_grid_simple = self
            .selector("search.results.gridSimple")
            .unwrap_or("[data-widget='skuGridSimple']");

        let input_sel = Self::js_string(search_input)?;
        let has_search = self
            .eval_value(
                transport,
                &format!("(() => !!document.querySelector({input_sel}))()"),
            )
            .await?;
        if !has_search.as_bool().unwrap_or(false) {
            self.browser_call(
                transport,
                "browser_navigate",
                json!({
                    "action": "url",
                    "url": "https://www.ozon.ru/",
                }),
            )
            .await?;
            self.wait_for_any_selector(transport, &[search_input], Duration::from_secs(12))
                .await?;
        }

        self.random_wait(500, 1500).await;

        // Capture current URL before search to detect navigation
        let pre_search_url = self
            .browser_call(transport, "browser_evaluate", json!({"expression": "window.location.href", "raw_result": false}))
            .await?
            .get("result")
            .and_then(Value::as_str)
            .map(String::from);

        self.browser_call(
            transport,
            "browser_interact",
            json!({
                "actions": [
                    {"type": "click", "selector": search_input, "clickCount": 3},
                    {"type": "clear", "selector": search_input},
                    {"type": "type", "selector": search_input, "text": query},
                    {"type": "wait", "timeout": Self::pseudo_random_range_ms(300, 800)},
                    {"type": "press_key", "key": "Enter"}
                ]
            }),
        )
        .await?;

        // Wait for URL to change (indicates search started) if we were already on a search page
        if pre_search_url.is_some() {
            let start = SystemTime::now();
            loop {
                let current_url = self
                    .browser_call(transport, "browser_evaluate", json!({"expression": "window.location.href", "raw_result": false}))
                    .await?
                    .get("result")
                    .and_then(Value::as_str)
                    .map(String::from);

                if current_url != pre_search_url {
                    break; // URL changed, search results loading
                }

                if start.elapsed().unwrap_or_else(|_| Duration::from_secs(0)) >= Duration::from_secs(5) {
                    break; // Timeout, continue anyway
                }

                sleep(Duration::from_millis(200)).await;
            }
        }

        self.wait_for_any_selector(
            transport,
            &[results_grid, results_grid_simple],
            Duration::from_secs(20),
        )
        .await?;

        // Human-ish scroll a bit to trigger lazy-loaded tiles.
        for _ in 0..2 {
            self.browser_call(
                transport,
                "browser_interact",
                json!({
                    "actions": [
                        {"type": "scroll_by", "x": 0, "y": Self::pseudo_random_range_ms(300, 800) },
                        {"type": "wait", "timeout": Self::pseudo_random_range_ms(400, 900)}
                    ]
                }),
            )
            .await?;
        }

        let tile_sel = self
            .selector("search.productCard.tile")
            .unwrap_or("div.tile-root");
        let link_sel = self
            .selector("search.productCard.link")
            .unwrap_or("a.tile-clickable-element");

        let tile_sel_js = Self::js_string(tile_sel)?;
        let link_sel_js = Self::js_string(link_sel)?;
        let expression = format!(
            "(() => {{\n  const tileSel = {tile_sel_js};\n  const linkSel = {link_sel_js};\n  const tiles = Array.from(document.querySelectorAll(tileSel)).slice(0, 12);\n  return tiles.map((tile, idx) => {{\n    const link = tile.querySelector(linkSel) || tile.querySelector('a[href]');\n    const url = link ? link.href : null;\n    const title = (link && (link.innerText || '').trim()) || ((tile.innerText || '').trim().split('\\n')[0] || null);\n    const text = (tile.innerText || '');\n    const m = text.match(/\\d+[\\s\\d]*\\s*₽/);\n    const price = m ? m[0].replace(/\\s+/g, ' ').trim() : null;\n    const selector = `${{tileSel}}:nth-of-type(${{idx + 1}}) ${{linkSel}}`;\n    return {{ index: idx, title, price, url, selector }};\n  }});\n}})()"
        );

        let items = self.eval_value(transport, &expression).await?;

        Ok(json!({
            "query": query,
            "items": items,
        }))
    }

    async fn handle_parse_product_page<T: Transport>(&self, transport: &T) -> Result<Value> {
        self.ensure_attached(transport).await?;

        self.browser_call(
            transport,
            "browser_interact",
            json!({
                "actions": [
                    {"type": "scroll_by", "x": 0, "y": Self::pseudo_random_range_ms(300, 800)},
                    {"type": "wait", "timeout": Self::pseudo_random_range_ms(400, 900)}
                ]
            }),
        )
        .await?;

        let heading = self
            .selector("product.heading")
            .unwrap_or("[data-widget='webProductHeading']");
        let price_current = self
            .selector("product.price.current")
            .unwrap_or("[data-widget='webPrice'] span.tsHeadline600Large");
        let description = self
            .selector("product.description")
            .unwrap_or("[data-widget='webDescription']");
        let char_full = self
            .selector("product.characteristics.full")
            .unwrap_or("[data-widget='webCharacteristics']");
        let char_short = self
            .selector("product.characteristics.short")
            .unwrap_or("[data-widget='webShortCharacteristics']");
        let atc_container = self
            .selector("product.addToCart.container")
            .unwrap_or("[data-widget='webAddToCart']");

        self.wait_for_any_selector(
            transport,
            &[heading, atc_container],
            Duration::from_secs(15),
        )
        .await
        .context("not a product page or page did not finish loading")?;

        let heading_js = Self::js_string(heading)?;
        let price_js = Self::js_string(price_current)?;
        let desc_js = Self::js_string(description)?;
        let full_js = Self::js_string(char_full)?;
        let short_js = Self::js_string(char_short)?;
        let atc_js = Self::js_string(atc_container)?;

        let expression = format!(
            "(() => {{\n  const s = {{ heading: {heading_js}, price: {price_js}, description: {desc_js}, full: {full_js}, short: {short_js}, atc: {atc_js} }};\n\n  const getTxt = (sel) => {{\n    const el = document.querySelector(sel);\n    return el ? (el.innerText || '').trim() : null;\n  }};\n\n  const parseCharacteristics = () => {{\n    let chars = [];\n    let el = document.querySelector(s.full) || document.querySelector(s.short);\n    if (!el) return chars;\n\n    const dts = el.querySelectorAll('dt');\n    const dds = el.querySelectorAll('dd');\n    if (dts.length > 0 && dts.length === dds.length) {{\n      for (let i = 0; i < dts.length; i++) {{\n        chars.push({{ name: (dts[i].innerText || '').trim(), value: (dds[i].innerText || '').trim() }});\n      }}\n      return chars;\n    }}\n\n    const rows = el.querySelectorAll('tr');\n    if (rows.length > 0) {{\n      rows.forEach((row) => {{\n        const cells = row.querySelectorAll('td, th');\n        if (cells.length >= 2) {{\n          chars.push({{ name: (cells[0].innerText || '').trim(), value: (cells[1].innerText || '').trim() }});\n        }}\n      }});\n      return chars;\n    }}\n\n    const text = (el.innerText || '').split('\\n').map(v => v.trim()).filter(Boolean);\n    for (let i = 0; i + 1 < text.length; i += 2) {{\n      chars.push({{ name: text[i], value: text[i + 1] }});\n    }}\n    return chars;\n  }};\n\n  const atcText = getTxt(s.atc) || '';\n  const availability = /нет\\s+в\\s+наличии/i.test(atcText) ? 'Out of stock' : 'Unknown';\n\n  return {{\n    title: getTxt(s.heading),\n    price: getTxt(s.price),\n    description: getTxt(s.description),\n    characteristics: parseCharacteristics(),\n    availability\n  }};\n}})()"
        );

        let mut data = self.eval_value(transport, &expression).await?;

        // Size dropdown (best-effort)
        if let Some(size_trigger) = self.selector("product.aspects.sizeDropdown.trigger") {
            let trig_js = Self::js_string(size_trigger)?;
            let has_trigger = self
                .eval_value(
                    transport,
                    &format!("(() => !!document.querySelector({trig_js}))()"),
                )
                .await?;
            if has_trigger.as_bool().unwrap_or(false) {
                let options_sel = self
                    .selector("product.aspects.sizeDropdown.options")
                    .unwrap_or("[role='option']");
                let selected_sel = self
                    .selector("product.aspects.sizeDropdown.selectedText")
                    .unwrap_or("[data-widget='webAspects'] [role='listbox'] span");

                self.random_wait(300, 600).await;
                let _ = self
                    .browser_call(
                        transport,
                        "browser_interact",
                        json!({
                            "actions": [
                                {"type": "click", "selector": size_trigger},
                                {"type": "wait", "timeout": Self::pseudo_random_range_ms(300, 600)}
                            ]
                        }),
                    )
                    .await;

                let opts_js = Self::js_string(options_sel)?;
                let sel_js = Self::js_string(selected_sel)?;
                let sizes_expr = format!(
                    "(() => {{\n  const optionsSel = {opts_js};\n  const selectedSel = {sel_js};\n  const options = Array.from(document.querySelectorAll(optionsSel)).map(o => (o.innerText || '').trim()).filter(Boolean);\n  const selected = (() => {{ const el = document.querySelector(selectedSel); return el ? (el.innerText || '').trim() : null; }})();\n  return {{ available: options, selected }};\n}})()"
                );
                let sizes = self
                    .eval_value(transport, &sizes_expr)
                    .await
                    .unwrap_or(Value::Null);

                let _ = self
                    .browser_call(
                        transport,
                        "browser_interact",
                        json!({
                            "actions": [
                                {"type": "press_key", "key": "Escape"},
                                {"type": "wait", "timeout": 150}
                            ]
                        }),
                    )
                    .await;

                if let Some(obj) = data.as_object_mut() {
                    obj.insert("sizes".to_string(), sizes);
                }
            }
        }

        Ok(data)
    }

    async fn handle_cart_action<T: Transport>(&self, transport: &T, args: &Value) -> Result<Value> {
        let action = args
            .get("action")
            .and_then(Value::as_str)
            .ok_or_else(|| anyhow!("action is required"))?;
        if !matches!(action, "add" | "increment" | "decrement") {
            bail!("unknown action: {action}");
        }

        self.ensure_attached(transport).await?;

        let atc_container = self
            .selector("product.addToCart.container")
            .unwrap_or("[data-widget='webAddToCart']");
        let button = self
            .selector("product.addToCart.button")
            .unwrap_or("[data-widget='webAddToCart'] button:first-of-type");
        let inc = self
            .selector("product.addToCart.increment")
            .unwrap_or("[data-widget='webAddToCart'] button:nth-of-type(3)");
        let dec = self
            .selector("product.addToCart.decrement")
            .unwrap_or("[data-widget='webAddToCart'] button:nth-of-type(2)");
        let qty_sel = self
            .selector("product.addToCart.quantity")
            .unwrap_or("[data-widget='webAddToCart'] span");
        let cart_icon = self
            .selector("header.cart.icon")
            .unwrap_or("a[href='/cart']");

        let qty_js = Self::js_string(qty_sel)?;
        let quantity_before = self
            .eval_value(
                transport,
                &format!(
                    "(() => {{ const el = document.querySelector({qty_js}); if (!el) return 0; const t=(el.innerText||'').replace(/\\s+/g,' ').trim(); const n=parseInt(t,10); return Number.isFinite(n)?n:0; }})()"
                ),
            )
            .await?
            .as_i64()
            .unwrap_or(0);

        self.random_wait(300, 800).await;

        // Decide which control to click.
        let desired_selector = match action {
            "add" => {
                if quantity_before <= 0 {
                    button
                } else {
                    inc
                }
            }
            "increment" => {
                if quantity_before <= 0 {
                    button
                } else {
                    inc
                }
            }
            "decrement" => dec,
            _ => button,
        };

        // Try real click first; fallback to DOM click within container (nth-of-type can be flaky).
        let click_result = self
            .browser_call(
                transport,
                "browser_interact",
                json!({
                    "actions": [
                        {"type": "click", "selector": desired_selector},
                    ]
                }),
            )
            .await;

        if click_result.is_err() {
            let container_js = Self::js_string(atc_container)?;
            let button_index = match desired_selector {
                s if s == button => 0,
                s if s == dec => 1,
                _ => 2,
            };
            let clicked = self
                .eval_value(
                    transport,
                    &format!(
                        "(() => {{\n  const c = document.querySelector({container_js});\n  if (!c) return false;\n  const btns = c.querySelectorAll('button');\n  const b = btns[{button_index}];\n  if (!b) return false;\n  b.click();\n  return true;\n}})()"
                    ),
                )
                .await?
                .as_bool()
                .unwrap_or(false);

            if !clicked {
                bail!("cart control not found (container/buttons)");
            }
        }

        self.random_wait(1000, 2500).await;

        let quantity_after = self
            .eval_value(
                transport,
                &format!(
                    "(() => {{ const el = document.querySelector({qty_js}); if (!el) return 0; const t=(el.innerText||'').replace(/\\s+/g,' ').trim(); const n=parseInt(t,10); return Number.isFinite(n)?n:0; }})()"
                ),
            )
            .await?
            .as_i64()
            .unwrap_or(0);

        let cart_js = Self::js_string(cart_icon)?;
        let cart_count = self
            .eval_value(
                transport,
                &format!(
                    "(() => {{ const el=document.querySelector({cart_js}); if(!el) return 0; const t=(el.innerText||''); const m=t.match(/\\d+/); return m ? parseInt(m[0],10) : 0; }})()"
                ),
            )
            .await?
            .as_i64()
            .unwrap_or(0);

        Ok(json!({
            "action": action,
            "quantity_before": quantity_before,
            "quantity": quantity_after,
            "cart_count": cart_count,
        }))
    }

    async fn handle_get_share_link<T: Transport>(&self, transport: &T) -> Result<Value> {
        self.ensure_attached(transport).await?;

        let url = self
            .eval_value(
                transport,
                r#"(() => {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const og = document.querySelector('meta[property="og:url"]')?.content;
  const u = canonical || og || window.location.href;
  return (u || '').split('?')[0];
})()"#,
            )
            .await?;

        Ok(json!({
            "url": url,
        }))
    }
}
