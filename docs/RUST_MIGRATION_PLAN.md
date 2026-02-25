# Ozon MCP JS -> Rust Migration Plan

## Objective

Build full behavioral parity for `server/` in Rust while keeping the existing Node.js runtime stable during migration.

## Scope Boundaries

- Rust work is additive until parity is proven.
- Chrome extension code under `extensions/` is out of scope.
- Iterative rollout: each slice must compile, be testable, and avoid behavior regressions.

## Module Parity Map

| Node.js module | Rust module | Iteration 1 status | Notes |
| --- | --- | --- | --- |
| `server/index.js` | `src/main.rs`, `src/app.rs`, `src/config.rs` | Scaffolded | Startup wiring and env loading only |
| `server/src/fileLogger.js` | `src/file_logger.rs` | Scaffolded | Deterministic stderr/file logger |
| `server/src/extensionServer.js` | `src/extension_server.rs` | Slice 2 foundation implemented | Real websocket listener, single active session, id correlation, timeout handling |
| `server/src/transport.js` | `src/transport.rs` | Slice 2 foundation implemented | Direct transport delegates to async bridge without outer mutex wait |
| `server/src/unifiedBackend.js` | `src/unified_backend.rs`, `src/tool_catalog.rs` | Scaffolded | Tool registry mirrored, handlers stubbed |
| `server/src/ozonHandler.js` | `src/ozon_handler.rs` | Scaffolded | Ozon tool boundary defined, logic pending |

## Tool Catalog Baseline

Iteration 1 keeps a complete static catalog for known tools.

- Browser tools (21):
  - `browser_tabs`
  - `browser_navigate`
  - `browser_interact`
  - `browser_snapshot`
  - `browser_lookup`
  - `browser_get_element_styles`
  - `browser_take_screenshot`
  - `browser_evaluate`
  - `browser_console_messages`
  - `browser_fill_form`
  - `browser_drag`
  - `browser_window`
  - `browser_verify_text_visible`
  - `browser_verify_element_visible`
  - `browser_network_requests`
  - `browser_pdf_save`
  - `browser_handle_dialog`
  - `browser_list_extensions`
  - `browser_reload_extensions`
  - `browser_performance_metrics`
  - `browser_extract_content`
- Ozon tools (4):
  - `ozon_search_and_parse`
  - `ozon_parse_product_page`
  - `ozon_cart_action`
  - `ozon_get_share_link`

## Slice-by-Slice Delivery Plan

### Slice 1: Scaffold and Contracts (this iteration)

Definition of done:

- Rust module tree mirrors JS server responsibilities.
- Main entrypoint loads env/CLI config and logs startup.
- Tool catalog includes all known `browser_*` and `ozon_*` names.
- `cargo fmt`, `cargo check`, `cargo test` pass.

### Slice 2: Transport Foundation (completed)

Definition of done:

- Replace in-memory extension bridge with real websocket server lifecycle.
- Preserve single active extension session semantics.
- Add timeout-safe request/response correlation layer.
- Add focused tests for not-connected error, response correlation, and timeout path.

### Slice 3: MCP Server Shell

Definition of done:

- Wire Rust MCP server bootstrap and stdio transport.
- Implement `ListTools` and `CallTool` routing with current catalog.
- Return structured not-implemented results for unported handlers.
- Validate startup/shutdown flow parity with Node baseline.

### Slice 4: Browser Tool Port (Core)

Definition of done:

- Port core browser tool set first (`tabs`, `navigate`, `interact`, `snapshot`, `evaluate`).
- Keep request/response schemas aligned with current JS contract.
- Add regression tests against fixture payloads.
- Verify no destructive side effects versus Node behavior.

### Slice 5: Browser Tool Port (Remaining)

Definition of done:

- Port remaining browser tools (`lookup`, `styles`, screenshot/pdf/network/dialog/window/forms/extensions/performance/extract).
- Preserve output shape compatibility for existing clients.
- Add golden tests for representative tool responses.

### Slice 6: Ozon Handler Port

Definition of done:

- Port Ozon business workflows and selector usage.
- Keep anti-bot pacing logic deterministic and configurable.
- Add selector-driven tests for parsing and cart actions.
- Verify fallback paths and error messaging parity.

### Slice 7: Full Parity Hardening

Definition of done:

- Cross-compare Rust vs Node outputs for all tools on shared scenarios.
- Resolve mismatch backlog until parity acceptance reaches 100% for supported flows.
- Document operational runbook for switching default runtime to Rust.
- Keep Node runtime as fallback until parity sign-off.

## Verification Checklist per Slice

- `cargo fmt --all`
- `cargo check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test`
- Incremental parity notes recorded in this document
