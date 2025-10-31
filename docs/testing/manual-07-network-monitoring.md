# Manual Test: Network Monitoring

**Test Count:** 10 tests
**Tools Covered:** `browser_network_requests`
**Prerequisites:** Server enabled, connected

---

## MT-47: List Network Requests

**Description:** View captured network requests

**Prerequisites:**
- Server connected
- Navigate to a page (generates network traffic)

**Steps:**
1. Navigate to https://example.com
2. Wait for page load
3. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "list"
   }
   ```

**Expected Results:**
- List of network requests returned
- Shows: URL, method, status, resource type
- Default limit 20 requests
- Most recent requests shown
- Both completed and pending requests

**Pass Criteria:**
- [ ] Request list returned
- [ ] HTML document request visible
- [ ] CSS/JS resources shown
- [ ] Status codes present

---

## MT-48: List with URL Filter

**Description:** Filter requests by URL pattern

**Prerequisites:**
- Server connected
- Page with API calls

**Steps:**
1. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "list",
     "urlPattern": "api"
   }
   ```

**Expected Results:**
- Only requests with "api" in URL
- Other requests filtered out
- Case-insensitive matching
- Useful for finding API calls

**Pass Criteria:**
- [ ] Only matching requests shown
- [ ] Filter works correctly
- [ ] Case-insensitive

---

## MT-49: List with Method Filter

**Description:** Filter by HTTP method

**Prerequisites:**
- Server connected
- Page with various request types

**Steps:**
1. Submit a form (generates POST request)
2. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "list",
     "method": "POST"
   }
   ```

**Expected Results:**
- Only POST requests shown
- GET/PUT/DELETE filtered out
- Form submission visible

**Pass Criteria:**
- [ ] Only POST shown
- [ ] Filter accurate
- [ ] Form request found

---

## MT-50: List with Status Filter

**Description:** Filter by HTTP status code

**Prerequisites:**
- Server connected

**Steps:**
1. Navigate to page with images (some may 404)
2. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "list",
     "status": 404
   }
   ```

**Expected Results:**
- Only 404 requests shown
- Failed resource loads visible
- Helpful for debugging

**Pass Criteria:**
- [ ] Only 404s shown
- [ ] Status filter works
- [ ] Failed requests identified

---

## MT-51: List with Resource Type Filter

**Description:** Filter by resource type

**Prerequisites:**
- Server connected
- Page loaded with various resources

**Steps:**
1. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "list",
     "resourceType": "image"
   }
   ```

**Expected Results:**
- Only image requests shown
- PNG, JPG, GIF, WebP, etc.
- Other types filtered

**Pass Criteria:**
- [ ] Only images shown
- [ ] All image formats included
- [ ] Type filter accurate

---

## MT-52: List with Pagination

**Description:** Handle large request lists with pagination

**Prerequisites:**
- Server connected
- Page with many requests (100+)

**Steps:**
1. Navigate to complex page (e.g., news site)
2. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "list",
     "limit": 10,
     "offset": 0
   }
   ```
3. Issue command with `offset: 10` for next page

**Expected Results:**
- First 10 requests returned
- Second call returns next 10
- No overlap
- Pagination works smoothly

**Pass Criteria:**
- [ ] Limit honored
- [ ] Offset works correctly
- [ ] No duplicates
- [ ] Can paginate through all

---

## MT-53: Get Request Details

**Description:** View full details of specific request

**Prerequisites:**
- Server connected
- Have requestId from list action

**Steps:**
1. List requests to get a requestId
2. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "details",
     "requestId": "12345.67"
   }
   ```

**Expected Results:**
- Full request details returned
- Request headers shown
- Response headers shown
- Response body included
- Timing information

**Pass Criteria:**
- [ ] Complete request data
- [ ] Headers present
- [ ] Body included (if any)
- [ ] Timing information shown

---

## MT-54: Get Details with JSONPath Filter

**Description:** Extract specific data from JSON response

**Prerequisites:**
- Server connected
- Have requestId for JSON API response

**Steps:**
1. Navigate to page with JSON API call
2. Get requestId for API request
3. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "details",
     "requestId": "98765.43",
     "jsonPath": "$.data.items[0]"
   }
   ```

**Expected Results:**
- Only matching JSON path data returned
- Full response not included
- Filtered JSON shown
- Useful for large API responses

**Pass Criteria:**
- [ ] JSONPath filter applied
- [ ] Only relevant data shown
- [ ] Valid JSON returned

---

## MT-55: Replay Request

**Description:** Re-execute a captured request

**Prerequisites:**
- Server connected
- Have requestId for safe request (GET, not destructive)

**Steps:**
1. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "replay",
     "requestId": "12345.67"
   }
   ```

**Expected Results:**
- Request re-executed with same parameters
- New response returned
- Original headers preserved
- New requestId generated

**Pass Criteria:**
- [ ] Replay succeeds
- [ ] Same endpoint hit
- [ ] New response received
- [ ] No errors

---

## MT-56: Clear Network History

**Description:** Clear captured requests from memory

**Prerequisites:**
- Server connected
- Requests captured

**Steps:**
1. Issue command: `browser_network_requests` with params:
   ```json
   {
     "action": "clear"
   }
   ```
2. Issue list command

**Expected Results:**
- Network history cleared
- Memory freed
- Subsequent list shows empty or only new requests
- Confirmation message

**Pass Criteria:**
- [ ] History cleared
- [ ] Old requests gone
- [ ] New requests still capture
- [ ] No errors

---

## Notes

- Network monitoring starts when extension connects
- Large responses may be truncated
- JSONPath useful for extracting API data
- Replay doesn't work for POST/PUT/DELETE safely
- Clear action frees memory for long sessions
