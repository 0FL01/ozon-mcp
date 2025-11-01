# Chrome Web Store Promotional Materials

This folder contains all promotional assets for the Blueprint MCP Chrome Extension submission.

## Files

### Description Text

**PERMISSIONS_JUSTIFICATIONS.txt**
- Character counts: All under 1,000 limit ✅
- Format: Plain text ready to copy/paste into Privacy practices tab
- Contains:
  - Single Purpose description (874 chars)
  - activeTab justification (642 chars)
  - alarms justification (660 chars)
  - debugger justification (708 chars)
  - host permission use justification (760 chars)
  - management justification (661 chars)
  - remote code use justification (711 chars)
  - storage justification (637 chars)
  - tabs justification (642 chars)
- Usage: Copy each section separately into corresponding Chrome Web Store form field

**DESCRIPTION.txt**
- Character count: 9,147 (under 16,000 limit) ✅
- Format: Plain text with simple ASCII characters (ready to paste)
- Usage: Copy/paste directly into Chrome Web Store listing form
- Includes: Hook, value prop, features, use cases, technical details, security, pricing, support
- Pricing: $5/month or $50/year ($1 for 14-day trial)
- Note: Uses -> for arrows and • for bullets (Chrome Web Store compatible)
- Key message: Context efficiency - direct browser control without massive snapshots (highlighted at top)
- Security: Accurate description of data flow in PRO mode (no logging, data passes through but not stored)

### Promo Tiles

**small_promo_tile.png**
- Dimensions: 440x280 pixels
- Format: 24-bit PNG (no alpha)
- File size: 23 KB
- Usage: Small promotional tile displayed in the Chrome Web Store
- Content: Logo + "Blueprint MCP for Chrome" + "Precisely Control Chrome with AI"

**marquee_promo_tile.png**
- Dimensions: 1400x560 pixels
- Format: 24-bit PNG (no alpha)
- File size: 72 KB
- Usage: Marquee promotional tile (featured placement) in the Chrome Web Store
- Content: Logo + "Blueprint MCP for Chrome" + "Precisely Control Chrome with AI" + "through the Model Context Protocol"

### Screenshots

**screenshot_free.png**
- Dimensions: Variable
- File size: 730 KB
- Usage: Screenshot showing free tier functionality

**screenshot_pro.png**
- Dimensions: Variable
- File size: 692 KB
- Usage: Screenshot showing PRO tier functionality

## Chrome Web Store Requirements

### Promo Tile Specifications
- Small tile: 440x280 canvas, JPEG or 24-bit PNG (no alpha)
- Marquee tile: 1400x560 canvas, JPEG or 24-bit PNG (no alpha)

### Screenshot Specifications
- Minimum: 640 x 400 pixels
- Maximum: 2400 x 1800 pixels
- At least 1 screenshot required, up to 5 screenshots allowed
- Format: JPEG or PNG

## Branding

**Product Name:** Blueprint MCP for Chrome
**Tagline:** Precisely Control Chrome with AI
**Background Color:** #1c75bc (brand blue)
**Text Colors:**
- Primary: #ffffff (white)
- Secondary: rgba(255,255,255,0.9) (white with 90% opacity)
- Tertiary: rgba(255,255,255,0.8) (white with 80% opacity)

## Generation

These promo tiles were generated using ImageMagick from the extension's logo files:
- Logo: `docs/stores/chrome/logo-inverted.png` (600x600, white logo for brand blue background)
- Background: Brand blue (#1c75bc)
- Tool: ImageMagick (magick command)
- Font: Arial (system font)

Example command (small tile):
```bash
magick -size 440x280 xc:'#1c75bc' \
  \( docs/stores/chrome/logo-inverted.png -resize 140x140 \) \
  -gravity center -geometry +0-30 -composite \
  -font Arial -pointsize 24 -fill white -gravity center \
  -annotate +0+75 "Blueprint MCP for Chrome" \
  -pointsize 14 -fill 'rgba(255,255,255,0.9)' \
  -annotate +0+100 "Precisely Control Chrome with AI" \
  docs/stores/chrome/small_promo_tile.png
```
