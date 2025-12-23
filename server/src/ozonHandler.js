

/**
 * OzonHandler
 * 
 * Encapsulates Ozon-specific business logic, separating it from the generic backend.
 * Handles:
 * - Ozon-specific tool definitions (ozon_search_and_parse, ozon_parse_product_page, etc.)
 * - Dispatching tool calls to specific handler methods
 * - Composing browser interactions using the transport layer
 */
class OzonHandler {
    /**
     * @param {object} backend - UnifiedBackend instance
     * @param {object} selectors - Ozon selectors configuration
     */
    constructor(backend, selectors) {
        this.backend = backend;
        this.selectors = selectors || {};
    }

    // ... (getTools and handleTool remain same, skipping to helpers) ...

    // --- Helpers ---

    async _evaluate(functionBody, args = {}) {
        // Reuse backend's _handleEvaluate logic or direct transport if needed.
        // backend._handleEvaluate expects { function, expression }
        const res = await this.backend._handleEvaluate({
            function: functionBody
        }, { rawResult: true });
        return res.value;
    }

    async _interact(actions) {
        // Reuse backend's _handleInteract logic
        return await this.backend._handleInteract({
            actions: actions
        }, { rawResult: true });
    }

    /**
     * Humanization utilities for anti-bot evasion
     */

    /**
     * Random wait between min and max milliseconds
     */
    async _randomWait(min, max) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await this._interact([{ type: 'wait', timeout: delay }]);
    }

    /**
     * Type text with human-like delays between characters
     * @param {string} selector - CSS selector for input field
     * @param {string} text - Text to type
     */
    async _humanType(selector, text) {
        // Click to focus
        await this._interact([{ type: 'click', selector }]);
        await this._randomWait(100, 300);

        // Type each character with random delay
        for (let i = 0; i < text.length; i++) {
            await this._interact([{ type: 'type', selector, text: text[i] }]);
            // Random delay between characters (50-150ms)
            if (i < text.length - 1) {
                await this._randomWait(50, 150);
            }
        }
    }

    /**
     * Perform human-like scrolling on the page
     */
    async _humanScroll() {
        // Random scroll down
        const scrollDown = Math.floor(Math.random() * 500) + 300;
        await this._interact([{ type: 'scroll_by', x: 0, y: scrollDown }]);
        await this._randomWait(500, 1000);

        // Sometimes scroll back up a bit
        if (Math.random() > 0.5) {
            const scrollUp = Math.floor(Math.random() * 200) + 100;
            await this._interact([{ type: 'scroll_by', x: 0, y: -scrollUp }]);
            await this._randomWait(300, 700);
        }
    }

    // --- Handlers ---

    /**
     * Get Ozon-specific tool definitions
     */
    getTools() {
        return [
            {
                name: 'ozon_search_and_parse',
                description: 'Search for products on Ozon and parse results',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'ozon_parse_product_page',
                description: 'Extract details from the current product page',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'ozon_cart_action',
                description: 'Smart cart action: add, increment, or decrement quantity',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['add', 'increment', 'decrement'],
                            description: 'Action to perform. "add" handles initial addition, "increment"/"decrement" adjust quantity.'
                        },
                        quantity: { type: 'number', description: 'Target quantity (not strictly used yet, logic is step-based)' }
                    },
                    required: ['action']
                }
            },
            {
                name: 'ozon_get_share_link',
                description: 'Get clean share link for the current product (without UTM)',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ];
    }

    /**
     * Handle an Ozon tool call
     * @param {string} name - Tool name
     * @param {object} args - Tool arguments
     */
    async handleTool(name, args) {
        switch (name) {
            case 'ozon_search_and_parse':
                return this.handleSearchAndParse(args);
            case 'ozon_parse_product_page':
                return this.handleParseProductPage(args);
            case 'ozon_cart_action':
                return this.handleCartAction(args);
            case 'ozon_get_share_link':
                return this.handleGetShareLink(args);
            default:
                throw new Error(`Unknown Ozon tool: ${name}`);
        }
    }



    // --- Handlers ---

    async handleSearchAndParse(args) {
        const { query } = args;
        const s = this.selectors.search;

        if (!s) throw new Error('Search selectors not configured');

        // Humanized search flow
        // 1. Random delay before starting (simulate thinking)
        await this._randomWait(500, 1500);

        // 2. Click search input with human-like delay
        await this._interact([{ type: 'click', selector: s.input, clickCount: 3 }]); // Select all
        await this._randomWait(200, 500);

        // 3. Type query with human-like character delays
        await this._humanType(s.input, query);

        // 4. Random delay before pressing Enter (simulate reading what was typed)
        await this._randomWait(300, 800);

        // 5. Press Enter
        await this._interact([{ type: 'press_key', key: 'Enter' }]);

        // 6. Wait for results with random delay (2-5 seconds)
        await this._randomWait(2000, 5000);

        // 7. Human-like scrolling to view results
        await this._humanScroll();
        await this._randomWait(500, 1000);

        // 3. Parse results via JS
        // Refined Parse Script using relative selectors where possible
        // We will try to rely on text lookup if selectors are failing, but task asked for JS injection.

        const parseResult = await this._evaluate(`
            () => {
                const getText = (el, sel) => {
                    const node = sel ? el.querySelector(sel) : null;
                    return node ? node.innerText : '';
                };

                const grid = document.querySelector("${s.results.grid}");
                if (!grid) return { items: [], error: 'Grid not found' };

                // Ozon structure: grid > div (wrapper) > div (tile)
                // We use the configured tile selector (div.tile-root)
                const cards = Array.from(grid.querySelectorAll("${s.productCard.tile}"));
                
                return {
                    items: cards.slice(0, 12).map((card, i) => {
                         // Find link - use specific selector or fallback
                         const linkNode = card.querySelector("${s.productCard.link}") || card.querySelector("a[href*='/product/']");
                         
                         const textContent = card.innerText;
                         const priceMatch = textContent.match(/\\d+[\\s\\d]*\\u20BD/); // Search for Ruble symbol
                         
                         return {
                             index: i,
                             title: linkNode ? linkNode.innerText.split('\\n')[0] : '', // First line usually title
                             price: priceMatch ? priceMatch[0] : '',
                             url: linkNode ? linkNode.href : '',
                             // Generate a click selector: 
                             // We construct a specific selector path for reliability in future interactions
                             selector: "${s.results.grid} ${s.productCard.tile}:nth-of-type(" + (i + 1) + ")" 
                         };
                    })
                };
            }
        `);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(parseResult.items || [], null, 2)
            }],
            isError: false
        };
    }

    async handleParseProductPage(args) {
        const s = this.selectors.product;

        // Humanization: scroll page before parsing (simulate reading)
        await this._randomWait(500, 1500);
        await this._humanScroll();
        await this._randomWait(800, 1500);

        const result = await this._evaluate(`
            () => {
                if (!document.querySelector("${s.heading}")) {
                    return { error: "Not a product page" };
                }
                
                const getTxt = (sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.innerText.trim() : null;
                };

                // Parse description block
                const parseDescription = () => {
                    const descEl = document.querySelector("${s.description}");
                    if (!descEl) return null;
                    return descEl.innerText.trim();
                };

                // Parse characteristics table
                const parseCharacteristics = () => {
                    const chars = [];
                    
                    // Try full characteristics first
                    let charEl = document.querySelector("${s.characteristics.full}");
                    if (!charEl) {
                        // Fallback to short characteristics
                        charEl = document.querySelector("${s.characteristics.short}");
                    }
                    if (!charEl) return chars;
                    
                    // Ozon uses dl/dt/dd structure or div-based rows
                    // Try dl/dt/dd first
                    const dtElements = charEl.querySelectorAll('dt');
                    const ddElements = charEl.querySelectorAll('dd');
                    if (dtElements.length > 0 && dtElements.length === ddElements.length) {
                        for (let i = 0; i < dtElements.length; i++) {
                            chars.push({
                                name: dtElements[i].innerText.trim(),
                                value: ddElements[i].innerText.trim()
                            });
                        }
                        return chars;
                    }
                    
                    // Try table structure
                    const rows = charEl.querySelectorAll('tr');
                    if (rows.length > 0) {
                        rows.forEach(row => {
                            const cells = row.querySelectorAll('td, th');
                            if (cells.length >= 2) {
                                chars.push({
                                    name: cells[0].innerText.trim(),
                                    value: cells[1].innerText.trim()
                                });
                            }
                        });
                        return chars;
                    }
                    
                    // Fallback: try to find spans with pairs (common Ozon pattern)
                    // Look for characteristic rows: usually divs with two spans
                    const charRows = charEl.querySelectorAll('[class*="char"], [class*="attribute"]');
                    if (charRows.length === 0) {
                        // Generic approach: find all direct child divs that look like rows
                        const allDivs = charEl.querySelectorAll('div > div');
                        allDivs.forEach(div => {
                            const spans = div.querySelectorAll('span');
                            if (spans.length >= 2) {
                                const name = spans[0].innerText.trim();
                                const value = spans[spans.length - 1].innerText.trim();
                                if (name && value && name !== value) {
                                    chars.push({ name, value });
                                }
                            }
                        });
                    }
                    
                    // If still empty, just grab all text as fallback
                    if (chars.length === 0) {
                        const lines = charEl.innerText.split('\\n').filter(l => l.trim());
                        for (let i = 0; i < lines.length - 1; i += 2) {
                            if (lines[i] && lines[i + 1]) {
                                chars.push({
                                    name: lines[i].trim(),
                                    value: lines[i + 1].trim()
                                });
                            }
                        }
                    }
                    
                    return chars;
                };

                // Check availability
                const checkAvailability = () => {
                    const addToCartEl = document.querySelector("${s.addToCart.container}");
                    if (!addToCartEl) return "Unknown";
                    const text = addToCartEl.innerText.toLowerCase();
                    if (text.includes('нет в наличии') || text.includes('закончился')) {
                        return "Out of stock";
                    }
                    return "Available";
                };

                return {
                    title: getTxt("${s.heading}"),
                    price: getTxt("${s.price.current}"),
                    variations: Array.from(document.querySelectorAll("${s.variations}"))
                        .map(el => el.innerText.trim()),
                    availability: checkAvailability(),
                    description: parseDescription(),
                    characteristics: parseCharacteristics()
                };
            }
        `);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
            }],
            isError: false
        };
    }

    async handleCartAction(args) {
        const { action } = args;
        const s = this.selectors.product.addToCart;

        // Logic sequence
        // 1. Check if "Add to cart" button exists or if we have +/- controls
        // We do this via evaluate to decide what to click.

        const state = await this._evaluate(`
            () => {
                const container = document.querySelector("${s.container}");
                if (!container) return { status: "missing" };
                
                const quantityEl = document.querySelector("${s.quantity}");
                const quantity = quantityEl ? parseInt(quantityEl.innerText) : 0;
                
                return { status: "ok", quantity };
            }
        `);

        if (state.status === "missing") {
            return { content: [{ type: 'text', text: "Add to cart widget not found" }], isError: true };
        }

        const actions = [];
        let cleanAction = action;

        // Smart logic: Override action based on state if needed?
        // "add" -> if q=0, click add. if q>0, maybe do nothing or increment? Let's strictly follow request.
        // User said: "Scenario Add: If counter missing - click addToCart.button".

        if (action === 'add') {
            if (state.quantity === 0) {
                actions.push({ type: 'click', selector: s.button });
            } else {
                return { content: [{ type: 'text', text: `Item already in cart (quantity: ${state.quantity})` }] };
            }
        } else if (action === 'increment') {
            if (state.quantity > 0) {
                // Workaround: querySelectorAll('button')[2] inside container
                // We can use a specialized selector in browser_interact if we supported it, 
                // but simpler to use evaluate to click or construct a precise selector approach.
                // The 's.increment' is defined as nth-of-type(3), lets try it.
                actions.push({ type: 'click', selector: s.increment });
            } else {
                // Try adding first?
                actions.push({ type: 'click', selector: s.button });
            }
        } else if (action === 'decrement') {
            if (state.quantity > 0) {
                actions.push({ type: 'click', selector: s.decrement });
            }
        }

        if (actions.length > 0) {
            // Humanization: random delay before clicking
            await this._randomWait(300, 800);

            await this._interact(actions);

            // Humanization: random wait for network response
            await this._randomWait(1000, 2500);

            // Check header cart icon
            const cartCountState = await this._evaluate(`
                () => {
                    const el = document.querySelector("${this.selectors.header.cart.icon} span"); // usually span has number
                    return el ? el.innerText : "0";
                }
            `);

            return {
                content: [{ type: 'text', text: `Action ${action} performed. Cart count: ${cartCountState}` }],
                isError: false
            };
        } else {
            return {
                content: [{ type: 'text', text: "No action performed (conditions not met)" }],
                isError: false
            };
        }
    }

    async handleGetShareLink(args) {
        // Just evaluate
        const result = await this._evaluate(`
            () => {
                // Try canonical
                const canonical = document.querySelector("link[rel='canonical']");
                if (canonical) return canonical.href;
                
                // Try OG
                const og = document.querySelector("meta[property='og:url']");
                if (og) return og.content;
                
                return window.location.href.split('?')[0]; // Fallback cleanup
            }
        `);

        return {
            content: [{ type: 'text', text: result }],
            isError: false
        };
    }
}

module.exports = OzonHandler;
