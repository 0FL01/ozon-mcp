# Edge Add-ons Store Submission Materials

**Last Updated:** 2025-11-03
**Extension Version:** 1.9.4

## Required Materials

### Extension Package ✅
- **File:** `releases/edge/blueprint-mcp-edge-v1.9.4.zip`
- **Size:** 1.6MB

### Text Content ✅

1. **SUMMARY.txt** (✅ Ready)
   - Short description for the listing
   - Character count: 187 characters (under 250 limit)
   - Content: "Give Claude Code and other AI assistants direct control of your real Edge browser through the Model Context Protocol. Stay logged in, bypass bot detection, automate authenticated workflows."

2. **DESCRIPTION.txt** (✅ Ready)
   - Full description of the extension
   - Formatted for Edge Add-ons store
   - Adapted from Opera/Chrome version with Edge-specific changes

3. **SEARCH_TERMS.txt** (✅ Ready)
   - 7 search terms (15 words total, under 21 limit)
   - All terms under 30 character limit
   - Optimized for discoverability

### Images

Edge Add-ons requires:

1. **Extension Logo** (✅ Ready)
   - 300x300px: `logo-300x300.png` (47KB)
   - Aspect ratio: 1:1 (required)
   - Meets Edge requirement: minimum 128x128, recommended 300x300

2. **Extension Icon** (✅ Ready)
   - Already in extension: 16x16, 32x32, 48x48, 128x128
   - Files: `extensions/edge/icons/icon-*.png` (in dist/edge after build)

3. **Small Promotional Tile** (✅ Ready)
   - 440x280px: `promo-440x280.png` (64KB)
   - Edge-specific branding: "Blueprint MCP for Edge"

4. **Large Promotional Tile** (✅ Ready)
   - 1400x560px: `promo-1400x560.png` (287KB)
   - Edge-specific branding: "Blueprint MCP for Edge"

5. **Screenshots** (Can reuse from Chrome)
   - Recommended: 1280x800px or 1920x1080px
   - At least 1 screenshot required
   - Available: `docs/stores/chrome/screenshot_free.png` and `screenshot_pro.png`
   - Note: Screenshots show the same UI/functionality across browsers

## Edge-Specific Notes

- Edge is Chromium-based, so the extension functionality is identical to Chrome
- Uses Chrome DevTools Protocol (CDP) - full feature set available
- All 20+ browser tools work perfectly
- Screenshots from Chrome store can be reused
- Extension uses the same build as Chrome/Opera (shared source code)

## Build Info

The Edge extension includes:
- ✅ Build timestamp (same as Chrome/Opera)
- ✅ Manifest V3 compliance
- ✅ Vanilla JavaScript (no build step required for development)
- ✅ All Chrome features (100% compatibility)

## Submission Checklist

- [x] Extension package (blueprint-mcp-edge-v1.9.4.zip)
- [x] Short summary (SUMMARY.txt)
- [x] Full description (DESCRIPTION.txt)
- [x] Search terms (SEARCH_TERMS.txt)
- [x] Extension logo 300x300 (logo-300x300.png)
- [x] Small promotional tile 440x280 (promo-440x280.png)
- [x] Large promotional tile 1400x560 (promo-1400x560.png)
- [x] Extension icons (in package)
- [ ] Screenshots (use Chrome versions)

## Submission URL

https://partner.microsoft.com/dashboard/microsoftedge/overview

## Post-Submission

After approval, the extension will be available at:
https://microsoftedge.microsoft.com/addons/detail/blueprint-mcp/

## Documentation References

- Main documentation: https://github.com/railsblueprint/blueprint-mcp
- Chrome compatibility: 100% (Edge is Chromium-based)
- Testing: Can use Chrome test results as reference

## Support

- GitHub Issues: https://github.com/railsblueprint/blueprint-mcp/issues
- Email: support@railsblueprint.com
