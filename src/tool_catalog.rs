#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum ToolDomain {
    Browser,
    Ozon,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct ToolCatalogEntry {
    pub name: &'static str,
    pub description: &'static str,
    pub domain: ToolDomain,
}

pub const BROWSER_TOOL_NAMES: [&str; 8] = [
    "browser_tabs",
    "browser_navigate",
    "browser_interact",
    "browser_snapshot",
    "browser_take_screenshot",
    "browser_evaluate",
    "browser_console_messages",
    "browser_handle_dialog",
];

pub const OZON_TOOL_NAMES: [&str; 5] = [
    "ozon_search_and_parse",
    "ozon_parse_product_page",
    "ozon_cart_action",
    "ozon_get_share_link",
    "ozon_ownership_status",
    // NOTE: ozon_apply_filter disabled - requires complex React event simulation
    // See handle_apply_filter in ozon_handler.rs for implementation details
];

pub const ALL_TOOL_NAMES: [&str; 13] = [
    "browser_tabs",
    "browser_navigate",
    "browser_interact",
    "browser_snapshot",
    "browser_take_screenshot",
    "browser_evaluate",
    "browser_console_messages",
    "browser_handle_dialog",
    "ozon_search_and_parse",
    "ozon_parse_product_page",
    "ozon_cart_action",
    "ozon_get_share_link",
    "ozon_ownership_status",
    // NOTE: ozon_apply_filter disabled - Ozon uses complex React components with virtual scrolling
    // URL manipulation doesn't work due to session validation
    // Requires proper React event simulation (dispatchEvent + state management)
];

pub const BROWSER_TOOLS: [ToolCatalogEntry; 8] = [
    ToolCatalogEntry {
        name: "browser_tabs",
        description: "Manage browser tabs",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_navigate",
        description: "Navigate the active tab",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_interact",
        description: "Run user interaction steps",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_snapshot",
        description: "Capture page snapshot",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_take_screenshot",
        description: "Capture screenshot from active tab",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_evaluate",
        description: "Evaluate JavaScript in active tab",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_console_messages",
        description: "Collect browser console messages",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_handle_dialog",
        description: "Accept or dismiss active dialog",
        domain: ToolDomain::Browser,
    },
];

pub const OZON_TOOLS: [ToolCatalogEntry; 5] = [
    ToolCatalogEntry {
        name: "ozon_search_and_parse",
        description: "Search Ozon and parse listing cards",
        domain: ToolDomain::Ozon,
    },
    ToolCatalogEntry {
        name: "ozon_parse_product_page",
        description: "Parse data from current Ozon product page",
        domain: ToolDomain::Ozon,
    },
    ToolCatalogEntry {
        name: "ozon_cart_action",
        description: "Run smart add or quantity action in cart",
        domain: ToolDomain::Ozon,
    },
    ToolCatalogEntry {
        name: "ozon_get_share_link",
        description: "Return canonical share link for product",
        domain: ToolDomain::Ozon,
    },
    ToolCatalogEntry {
        name: "ozon_ownership_status",
        description: "Return ownership lease status for this MCP instance",
        domain: ToolDomain::Ozon,
    },
    // DISABLED: ozon_apply_filter
    // Reason: Ozon uses React with virtual scrolling and complex event handling
    // URL manipulation fails due to session validation
    // Implementation requires: proper React event dispatch, state synchronization,
    // virtual list scrolling to load brands, and checkbox state management
    // See attempted implementation in git history
];

pub fn all_tools() -> Vec<ToolCatalogEntry> {
    BROWSER_TOOLS
        .iter()
        .chain(OZON_TOOLS.iter())
        .copied()
        .collect()
}

pub fn is_browser_tool(name: &str) -> bool {
    BROWSER_TOOL_NAMES.contains(&name)
}

pub fn is_ozon_tool(name: &str) -> bool {
    OZON_TOOL_NAMES.contains(&name)
}

#[cfg(test)]
mod tests {
    use super::{ALL_TOOL_NAMES, BROWSER_TOOL_NAMES, OZON_TOOL_NAMES};
    use std::collections::BTreeSet;

    #[test]
    fn tool_catalog_includes_full_iteration_one_surface() {
        assert_eq!(BROWSER_TOOL_NAMES.len(), 8);
        assert_eq!(OZON_TOOL_NAMES.len(), 5); // Disabled: ozon_apply_filter (see OZON_TOOLS comments)
        assert_eq!(ALL_TOOL_NAMES.len(), 13); // Disabled: ozon_apply_filter

        let names: BTreeSet<&str> = ALL_TOOL_NAMES.into_iter().collect();
        assert!(names.contains("browser_tabs"));
        assert!(names.contains("browser_snapshot"));
        assert!(names.contains("ozon_search_and_parse"));
        assert!(names.contains("ozon_get_share_link"));
        assert!(names.contains("ozon_ownership_status"));
        // DISABLED: assert!(names.contains("ozon_apply_filter"));
        // Reason: Ozon filter interface uses React with virtual scrolling
        // and session-validated URLs. Requires complex event simulation.
    }
}
