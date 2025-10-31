# Manual Test: Forms and Element Lookup

**Test Count:** 6 tests
**Tools Covered:** `browser_fill_form`, `browser_lookup`
**Prerequisites:** Server enabled, connected, form page loaded

---

## MT-41: Fill Form - Multiple Fields

**Description:** Fill multiple form fields at once

**Prerequisites:**
- Server connected
- Navigate to page with form (test page recommended)

**Steps:**
1. Issue command: `browser_fill_form` with params:
   ```json
   {
     "fields": [
       {"selector": "#name", "value": "John Doe"},
       {"selector": "#email", "value": "john@example.com"},
       {"selector": "#message", "value": "Test message"}
     ]
   }
   ```
2. Check all form fields

**Expected Results:**
- All three fields filled correctly
- Name shows "John Doe"
- Email shows "john@example.com"
- Message shows "Test message"
- All fields filled in one operation

**Pass Criteria:**
- [ ] All fields filled
- [ ] Values match exactly
- [ ] No fields missed
- [ ] Single operation

---

## MT-42: Fill Form - Select Dropdown

**Description:** Fill form including select element

**Prerequisites:**
- Server connected
- Form with select dropdown

**Steps:**
1. Issue command: `browser_fill_form` with params:
   ```json
   {
     "fields": [
       {"selector": "#country", "value": "USA"},
       {"selector": "#state", "value": "CA"}
     ]
   }
   ```

**Expected Results:**
- Dropdown selections made
- Correct options selected
- Select values updated

**Pass Criteria:**
- [ ] Dropdowns changed
- [ ] Correct options selected
- [ ] Values persisted

---

## MT-43: Fill Form - Checkbox and Radio

**Description:** Handle checkboxes and radio buttons

**Prerequisites:**
- Server connected
- Form with checkbox/radio inputs

**Steps:**
1. Issue command: `browser_fill_form` with params:
   ```json
   {
     "fields": [
       {"selector": "#agree-terms", "value": "true"},
       {"selector": "#gender-male", "value": "true"}
     ]
   }
   ```

**Expected Results:**
- Checkbox checked
- Radio button selected
- Boolean values handled correctly

**Pass Criteria:**
- [ ] Checkbox state correct
- [ ] Radio selected
- [ ] Form data updated

---

## MT-44: Lookup Elements by Text

**Description:** Find elements containing specific text

**Prerequisites:**
- Server connected
- Page with various text elements

**Steps:**
1. Issue command: `browser_lookup` with params:
   ```json
   {
     "text": "Submit"
   }
   ```

**Expected Results:**
- List of elements containing "Submit"
- Each result shows selector
- Shows element details (tag, text, attributes)
- Results sorted by relevance
- Limit to 10 results (default)

**Pass Criteria:**
- [ ] Elements found
- [ ] Selectors provided
- [ ] Text matches shown
- [ ] Details helpful

---

## MT-45: Lookup with Custom Limit

**Description:** Control number of search results

**Prerequisites:**
- Server connected
- Page with many matching elements

**Steps:**
1. Issue command: `browser_lookup` with params:
   ```json
   {
     "text": "click",
     "limit": 3
   }
   ```

**Expected Results:**
- Maximum 3 results returned
- Most relevant results prioritized
- Limit parameter honored

**Pass Criteria:**
- [ ] Exactly 3 or fewer results
- [ ] Best matches shown
- [ ] Limit works correctly

---

## MT-46: Lookup No Results

**Description:** Handle search with no matches

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_lookup` with params:
   ```json
   {
     "text": "zzzzz-nonexistent-text-zzzzz"
   }
   ```

**Expected Results:**
- Empty results array or message
- No error thrown
- Indicates no matches found
- Helpful message returned

**Pass Criteria:**
- [ ] Graceful no-results handling
- [ ] No crash or error
- [ ] Clear message

---

## Notes

- browser_fill_form handles all input types
- browser_lookup is case-insensitive
- Lookup helps find elements when selector unknown
- Use lookup results to build selectors for interactions
- Fill form is atomic (all fields or none)
