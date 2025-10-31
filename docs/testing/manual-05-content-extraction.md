# Manual Test: Content Extraction

**Test Count:** 9 tests
**Tools Covered:** `browser_snapshot`, `browser_extract_content`, `browser_take_screenshot`
**Prerequisites:** Server enabled, connected, page loaded

---

## MT-32: Get Page Snapshot

**Description:** Extract accessible DOM tree

**Prerequisites:**
- Server connected
- Navigate to test page

**Steps:**
1. Issue command: `browser_snapshot` with params `{}`
2. Review returned data

**Expected Results:**
- Accessible DOM tree returned
- Contains text content and structure
- Shows interactive elements (links, buttons, inputs)
- Excludes hidden/display:none elements
- Format is hierarchical text representation

**Pass Criteria:**
- [ ] Snapshot returned
- [ ] Contains visible page content
- [ ] Shows element hierarchy
- [ ] No script/style content included

---

## MT-33: Extract Content - Auto Mode

**Description:** Extract main content automatically

**Prerequisites:**
- Server connected
- Navigate to article or content page (e.g., Wikipedia)

**Steps:**
1. Issue command: `browser_extract_content` with params:
   ```json
   {
     "mode": "auto"
   }
   ```

**Expected Results:**
- Main article/content extracted
- Headers, navigation excluded
- Clean markdown format
- Readable text structure

**Pass Criteria:**
- [ ] Content extracted
- [ ] Main content identified correctly
- [ ] Markdown formatting present
- [ ] No boilerplate/chrome

---

## MT-34: Extract Content - Full Page

**Description:** Extract entire page content

**Prerequisites:**
- Server connected
- Page loaded

**Steps:**
1. Issue command: `browser_extract_content` with params:
   ```json
   {
     "mode": "full"
   }
   ```

**Expected Results:**
- Full page content returned
- Includes headers, footers, navigation
- All text extracted
- Markdown formatted

**Pass Criteria:**
- [ ] All page content present
- [ ] Headers/footers included
- [ ] No content missing

---

## MT-35: Extract Content - By Selector

**Description:** Extract specific element content

**Prerequisites:**
- Server connected
- Page with identifiable content container

**Steps:**
1. Issue command: `browser_extract_content` with params:
   ```json
   {
     "mode": "selector",
     "selector": "article"
   }
   ```

**Expected Results:**
- Only article element content extracted
- Content within selector scope
- Clean markdown
- Other page sections excluded

**Pass Criteria:**
- [ ] Selector content extracted
- [ ] Only specified element included
- [ ] Clean markdown format

---

## MT-36: Extract Content - Pagination

**Description:** Extract large content with pagination

**Prerequisites:**
- Server connected
- Navigate to long article/page

**Steps:**
1. Issue command: `browser_extract_content` with params:
   ```json
   {
     "mode": "full",
     "max_lines": 50,
     "offset": 0
   }
   ```
2. Review first page
3. Issue command with `offset: 50` for next page

**Expected Results:**
- First 50 lines returned
- Second call returns lines 51-100
- No overlap between pages
- Can continue pagination

**Pass Criteria:**
- [ ] Pagination works
- [ ] No duplicate content
- [ ] Offset parameter honored
- [ ] Content continues correctly

---

## MT-37: Take Screenshot - Default

**Description:** Capture viewport screenshot

**Prerequisites:**
- Server connected
- Page loaded

**Steps:**
1. Issue command: `browser_take_screenshot` with params `{}`
2. Check returned data

**Expected Results:**
- Screenshot returned as base64 data
- JPEG format (default)
- Quality 80 (default)
- Viewport only (not full page)
- Image data valid

**Pass Criteria:**
- [ ] Screenshot returned
- [ ] Base64 data present
- [ ] JPEG format
- [ ] Shows current viewport

---

## MT-38: Take Screenshot - Full Page

**Description:** Capture entire scrollable page

**Prerequisites:**
- Server connected
- Page with scrollable content

**Steps:**
1. Issue command: `browser_take_screenshot` with params:
   ```json
   {
     "fullPage": true
   }
   ```

**Expected Results:**
- Full page screenshot returned
- Includes content below fold
- May be very tall image
- All page content visible

**Pass Criteria:**
- [ ] Full page captured
- [ ] Below-fold content included
- [ ] Image taller than viewport
- [ ] No content cut off

---

## MT-39: Take Screenshot - PNG Format

**Description:** Capture screenshot in PNG format

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_take_screenshot` with params:
   ```json
   {
     "type": "png"
   }
   ```

**Expected Results:**
- PNG format screenshot
- Better quality than JPEG
- Supports transparency
- Larger file size than JPEG

**Pass Criteria:**
- [ ] PNG screenshot returned
- [ ] Image format is PNG
- [ ] Quality higher than JPEG

---

## MT-40: Take Screenshot - Custom Quality

**Description:** Control JPEG compression quality

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_take_screenshot` with params:
   ```json
   {
     "type": "jpeg",
     "quality": 95
   }
   ```

**Expected Results:**
- High quality JPEG
- Quality setting 95
- Better quality but larger size than default
- Minimal compression artifacts

**Pass Criteria:**
- [ ] High quality screenshot
- [ ] File larger than quality 80
- [ ] Visual quality excellent

---

## Notes

- Snapshot is text-based, screenshot is image
- Extract_content returns markdown
- Screenshots return base64 data
- Full page screenshots can be very large
- PNG screenshots don't support quality parameter
