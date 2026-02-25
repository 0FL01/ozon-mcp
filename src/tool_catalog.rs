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

pub const BROWSER_TOOL_NAMES: [&str; 21] = [
    "browser_tabs",
    "browser_navigate",
    "browser_interact",
    "browser_snapshot",
    "browser_lookup",
    "browser_get_element_styles",
    "browser_take_screenshot",
    "browser_evaluate",
    "browser_console_messages",
    "browser_fill_form",
    "browser_drag",
    "browser_window",
    "browser_verify_text_visible",
    "browser_verify_element_visible",
    "browser_network_requests",
    "browser_pdf_save",
    "browser_handle_dialog",
    "browser_list_extensions",
    "browser_reload_extensions",
    "browser_performance_metrics",
    "browser_extract_content",
];

pub const OZON_TOOL_NAMES: [&str; 4] = [
    "ozon_search_and_parse",
    "ozon_parse_product_page",
    "ozon_cart_action",
    "ozon_get_share_link",
];

pub const ALL_TOOL_NAMES: [&str; 25] = [
    "browser_tabs",
    "browser_navigate",
    "browser_interact",
    "browser_snapshot",
    "browser_lookup",
    "browser_get_element_styles",
    "browser_take_screenshot",
    "browser_evaluate",
    "browser_console_messages",
    "browser_fill_form",
    "browser_drag",
    "browser_window",
    "browser_verify_text_visible",
    "browser_verify_element_visible",
    "browser_network_requests",
    "browser_pdf_save",
    "browser_handle_dialog",
    "browser_list_extensions",
    "browser_reload_extensions",
    "browser_performance_metrics",
    "browser_extract_content",
    "ozon_search_and_parse",
    "ozon_parse_product_page",
    "ozon_cart_action",
    "ozon_get_share_link",
];

pub const BROWSER_TOOLS: [ToolCatalogEntry; 21] = [
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
        name: "browser_lookup",
        description: "Lookup snapshot element by ref",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_get_element_styles",
        description: "Read computed element styles",
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
        name: "browser_fill_form",
        description: "Fill form fields by selector",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_drag",
        description: "Perform drag and drop",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_window",
        description: "Control browser window state",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_verify_text_visible",
        description: "Verify text is visible on page",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_verify_element_visible",
        description: "Verify element is visible on page",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_network_requests",
        description: "List captured network requests",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_pdf_save",
        description: "Save current page as PDF",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_handle_dialog",
        description: "Accept or dismiss active dialog",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_list_extensions",
        description: "List installed browser extensions",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_reload_extensions",
        description: "Reload browser extensions",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_performance_metrics",
        description: "Read browser performance metrics",
        domain: ToolDomain::Browser,
    },
    ToolCatalogEntry {
        name: "browser_extract_content",
        description: "Extract structured page content",
        domain: ToolDomain::Browser,
    },
];

pub const OZON_TOOLS: [ToolCatalogEntry; 4] = [
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
        assert_eq!(BROWSER_TOOL_NAMES.len(), 21);
        assert_eq!(OZON_TOOL_NAMES.len(), 4);
        assert_eq!(ALL_TOOL_NAMES.len(), 25);

        let names: BTreeSet<&str> = ALL_TOOL_NAMES.into_iter().collect();
        assert!(names.contains("browser_tabs"));
        assert!(names.contains("browser_extract_content"));
        assert!(names.contains("ozon_search_and_parse"));
        assert!(names.contains("ozon_get_share_link"));
    }
}
