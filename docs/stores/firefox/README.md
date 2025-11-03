# Firefox Add-ons Store Submission Materials

**Last Updated:** 2025-11-03
**Extension Version:** 1.9.4

## Required Materials

### Extension Package ✅
- **File:** `releases/firefox/blueprint-mcp-firefox-v1.9.4.zip`
- **Size:** 227KB
- **Add-on ID:** `blueprint-mcp@railsblueprint.com`

### Text Content ✅

1. **SUMMARY.txt** (✅ Ready)
   - Short description for the listing
   - Character count: 191 characters (under 250 limit)
   - Content: "Give Claude Code and other AI assistants direct control of your real Firefox browser through the Model Context Protocol. Stay logged in, bypass bot detection, automate authenticated workflows."

2. **DESCRIPTION.txt** (✅ Ready)
   - Full description of the extension
   - Formatted for Firefox Add-ons store
   - Adapted from Chrome version with Firefox-specific changes
   - Includes Firefox-specific limitations section (CDP compatibility issues)

### Images

Firefox Add-ons typically requires:

1. **Extension Icon** (✅ Ready)
   - Already in extension: 16x16, 32x32, 48x48, 96x96, 128x128
   - Files: `extensions/firefox/icons/icon-*.png`

2. **Screenshots** (Can reuse from Chrome)
   - Recommended: 1280x800px or 1920x1080px
   - At least 1 screenshot required
   - Available: `docs/stores/chrome/screenshot_free.png` and `screenshot_pro.png`
   - Note: Screenshots show the same UI/functionality across browsers

3. **Promotional Image** (Optional)
   - Can use Chrome marquee tile: `docs/stores/chrome/marquee_promo_tile.png` (73KB)
   - Or create Firefox-specific version if needed

## Firefox-Specific Notes

### Known Limitations (Documented in DESCRIPTION.txt)

The Firefox extension has several Chrome DevTools Protocol (CDP) limitations:

**Not Available:**
- `browser_snapshot` - Accessibility.getFullAXTree not supported
- `browser_handle_dialog` - Page.handleJavaScriptDialog not supported
- `browser_pdf_save` - Page.printToPDF not supported
- `browser_performance_metrics` - Target.getTargetInfo not supported
- `browser_window` resize/maximize - Emulation.setDeviceMetricsOverride not supported
- Forced pseudo-states - DOM.enable not supported

**Working Features (~75% of functionality):**
- Navigation, clicking, typing, scrolling
- Screenshots and content extraction
- Network monitoring with filters
- Form automation
- Console messages
- JavaScript evaluation
- Tab management
- Extension management

### Build Info

The Firefox extension now includes:
- ✅ Build timestamp (added 2025-11-03)
- ✅ Add-on ID: `blueprint-mcp@railsblueprint.com`
- ✅ Manifest V3 compliance
- ✅ Vanilla JavaScript (no build step required for development)

### Testing Status

Comprehensive manual testing completed (97+ tests):
- **Pass Rate:** ~75%
- **Full Report:** `/docs/FIREFOX_COMPATIBILITY.md`
- Production-ready for web scraping, form automation, and basic browser control

## Submission Checklist

- [x] Extension package with add-on ID
- [x] Short summary (SUMMARY.txt)
- [x] Full description (DESCRIPTION.txt)
- [x] Extension icons (in package)
- [ ] Screenshots (use Chrome versions or create Firefox-specific)
- [ ] Promotional image (optional)

## Submission URL

https://addons.mozilla.org/developers/addon/submit/upload-listed

## Post-Submission

After approval, the extension will be available at:
https://addons.mozilla.org/firefox/addon/blueprint-mcp/

## Documentation References

- Main documentation: https://github.com/railsblueprint/blueprint-mcp
- Firefox compatibility: https://github.com/railsblueprint/blueprint-mcp/blob/main/docs/FIREFOX_COMPATIBILITY.md
- Testing results: Documented in FIREFOX_COMPATIBILITY.md

## Support

- GitHub Issues: https://github.com/railsblueprint/blueprint-mcp/issues
- Email: support@railsblueprint.com
