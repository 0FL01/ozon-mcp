# Manual Test: Page Interactions

**Test Count:** 11 tests
**Tools Covered:** `browser_interact`
**Prerequisites:** Server enabled, connected, test page loaded

---

## MT-22: Click Element by Selector

**Description:** Click a button using CSS selector

**Prerequisites:**
- Server connected
- Navigate to test page (use `browser_navigate` action `test_page`)

**Steps:**
1. Issue command: `browser_interact` with params:
   ```json
   {
     "actions": [
       {
         "type": "click",
         "selector": "#click-target-1"
       }
     ]
   }
   ```
2. Check `#event-log` on page to verify click was registered

**Expected Results:**
- Click executes successfully
- Click event appears in #event-log
- Response indicates success
- Response shows "Clicked #click-target-1"

**Pass Criteria:**
- [ ] Click completes without error
- [ ] Button reacts to click
- [ ] Page shows expected response

---

## MT-23: Type Text into Input Field

**Description:** Enter text into a form input

**Prerequisites:**
- Server connected
- Test page loaded with input field

**Steps:**
1. Issue command: `browser_interact` with params:
   ```json
   {
     "actions": [
       {
         "type": "type",
         "selector": "#username",
         "text": "Test User"
       }
     ]
   }
   ```
2. Visually verify input field value in browser
3. Check `#event-log` for input events

**Expected Results:**
- Text appears in #username field
- Each character typed correctly
- Input receives focus during typing
- Field value is "Test User"
- Input events logged

**Pass Criteria:**
- [ ] Text appears in field
- [ ] All characters present
- [ ] No typing errors

---

## MT-24: Clear Input Field

**Description:** Clear existing text from input

**Prerequisites:**
- Server connected
- Input field has existing text (from MT-23)

**Steps:**
1. Issue command: `browser_interact` with params:
   ```json
   {
     "actions": [
       {
         "type": "clear",
         "selector": "#username"
       }
     ]
   }
   ```
2. Visually verify input field is empty

**Expected Results:**
- #username field becomes empty
- No text remains
- Field still exists and is functional
- Clear event may appear in #event-log

**Pass Criteria:**
- [ ] Field cleared completely
- [ ] No residual text
- [ ] Field remains usable

---

## MT-25: Press Key

**Description:** Press specific keyboard key

**Prerequisites:**
- Server connected
- Test page loaded

**Steps:**
1. First, focus an input field:
   ```json
   {
     "actions": [
       {
         "type": "click",
         "selector": "#username"
       }
     ]
   }
   ```
2. Then press Enter key:
   ```json
   {
     "actions": [
       {
         "type": "press_key",
         "key": "Enter"
       }
     ]
   }
   ```
3. Check #event-log for key event

**Expected Results:**
- Key press registers
- Enter key event appears in #event-log
- Key event handled by page

**Pass Criteria:**
- [ ] Key press executes
- [ ] Page responds correctly
- [ ] No errors

---

## MT-26: Hover Over Element

**Description:** Trigger hover action and verify via event log

**Prerequisites:**
- Server connected
- Test page with hover-sensitive element

**Steps:**
1. Hover over element:
   ```json
   {
     "actions": [
       {
         "type": "hover",
         "selector": "#hover-target"
       }
     ]
   }
   ```
2. Check #event-log on page OR evaluate:
   ```json
   {
     "expression": "document.querySelector('#event-log')?.textContent"
   }
   ```

**Expected Results:**
- Hover action executes successfully
- Event log shows "Hover: Mouse entered hover target"
- Event log shows "Hover: Mouse left hover target"
- #coordinates shows mouse position
- Response indicates "Hovered over #hover-target"

**Pass Criteria:**
- [ ] Hover executes without error
- [ ] Hover events appear in #event-log
- [ ] Element text: "Hover over me to change my appearance"

**Note:** The `hover` action triggers events but doesn't persist for screenshots. For persistent hover states (e.g., testing dropdown menus, tooltips, hover colors), use `force_pseudo_state` instead (see MT-26B below).

---

## MT-26B: Force Hover Pseudo-State (Persistent Hover)

**Description:** Force persistent :hover pseudo-state for screenshot testing

**Prerequisites:**
- Server connected
- Test page with hover-sensitive element

**Steps:**
1. Scroll to element and take BEFORE screenshot:
   ```json
   {
     "actions": [
       {"type": "scroll_into_view", "selector": "#hover-target"}
     ]
   }
   ```
   Then: `browser_take_screenshot` to capture default state

2. Force hover pseudo-state:
   ```json
   {
     "actions": [
       {
         "type": "force_pseudo_state",
         "selector": "#hover-target",
         "pseudoStates": ["hover"]
       }
     ]
   }
   ```

3. Take AFTER screenshot:
   `browser_take_screenshot` to capture hover state

4. Clear forced state (optional):
   ```json
   {
     "actions": [
       {
         "type": "force_pseudo_state",
         "selector": "#hover-target",
         "pseudoStates": []
       }
     ]
   }
   ```

**Expected Results:**
- BEFORE screenshot shows light gray background
- force_pseudo_state executes successfully
- AFTER screenshot shows **bright blue background** (actual CSS :hover rule)
- Hover state persists between commands
- Clear action returns element to default state

**Pass Criteria:**
- [ ] force_pseudo_state completes without error
- [ ] AFTER screenshot shows hover styling (blue background)
- [ ] Clear action removes hover state
- [ ] Element returns to default appearance

**Technical Details:**
- Uses Chrome DevTools Protocol `CSS.forcePseudoState`
- Forces REAL browser pseudo-classes (not CSS injection)
- Works with background images, child elements, complex animations
- Supported pseudo-states: hover, active, focus, visited, focus-within

**Use Cases:**
- Testing dropdown menus
- Testing tooltips
- Testing navigation submenus
- Capturing hover state screenshots
- Testing hover-triggered animations

---

## MT-27: Multiple Actions in Sequence

**Description:** Execute several actions in one command

**Prerequisites:**
- Server connected
- Test page with form

**Steps:**
1. Issue command: `browser_interact` with params:
   ```json
   {
     "actions": [
       {
         "type": "click",
         "selector": "#username"
       },
       {
         "type": "type",
         "selector": "#username",
         "text": "John"
       },
       {
         "type": "click",
         "selector": "#email"
       },
       {
         "type": "type",
         "selector": "#email",
         "text": "john@example.com"
       }
     ]
   }
   ```
2. Visually verify both fields are filled
3. Check #event-log shows all 4 actions

**Expected Results:**
- All 4 actions execute in order
- #username field shows "John"
- #email field shows "john@example.com"
- No errors between actions
- All events appear in #event-log

**Pass Criteria:**
- [ ] All actions complete
- [ ] Correct order maintained
- [ ] Both fields filled correctly

---

## MT-28: Click with Different Mouse Buttons

**Description:** Test right-click and middle-click

**Prerequisites:**
- Server connected
- Test page loaded

**Steps:**
1. Issue command: `browser_interact` with params:
   ```json
   {
     "actions": [
       {
         "type": "click",
         "selector": "#click-target-2",
         "button": "right"
       }
     ]
   }
   ```
2. Check #event-log for contextmenu event
3. Browser context menu may appear (can be dismissed)

**Expected Results:**
- Right-click executes
- Right-click (contextmenu) event fires
- Event appears in #event-log as "contextmenu" type
- Browser's context menu may appear

**Pass Criteria:**
- [ ] Right-click registers
- [ ] Different from left click behavior
- [ ] No errors

---

## MT-29: Wait Action

**Description:** Pause between actions

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_interact` with params:
   ```json
   {
     "actions": [
       {
         "type": "click",
         "selector": "#delayed-show"
       },
       {
         "type": "wait",
         "timeout": 2500
       },
       {
         "type": "click",
         "selector": "#delayed-element"
       }
     ]
   }
   ```
2. Observe #delayed-element appears after first click
3. Verify second click happens after 2s wait

**Expected Results:**
- First click on #delayed-show executes
- #delayed-element becomes visible after ~2.5s
- 2.5 second wait occurs
- Second click on #delayed-element executes
- Total time ~2.5+ seconds
- Both clicks appear in #event-log

**Pass Criteria:**
- [ ] Both clicks execute
- [ ] Pause happens between
- [ ] Second element clickable after animation

---

## MT-30: Scroll Element into View

**Description:** Scroll page to make element visible

**Prerequisites:**
- Server connected
- Test page with element below fold

**Steps:**
1. Scroll to top of page first (if needed)
2. Issue command: `browser_interact` with params:
   ```json
   {
     "actions": [
       {
         "type": "scroll_into_view",
         "selector": "#scroll-container-2"
       }
     ]
   }
   ```
3. Visually verify #scroll-container-2 is now visible

**Expected Results:**
- Page scrolls automatically
- #scroll-container-2 becomes visible in viewport
- Element scrolled into view (centered or at top)
- Scroll completes without error

**Pass Criteria:**
- [ ] Page scrolls
- [ ] Element visible after scroll
- [ ] No errors

---

## MT-31: Error Handling - Invalid Selector

**Description:** Verify error when selector not found

**Prerequisites:**
- Server connected

**Steps:**
1. Issue command: `browser_interact` with params:
   ```json
   {
     "actions": [
       {
         "type": "click",
         "selector": "#does-not-exist"
       }
     ]
   }
   ```

**Expected Results:**
- Error returned
- Error mentions selector not found
- Helpful suggestions may be included
- No crash

**Pass Criteria:**
- [ ] Error returned
- [ ] Message mentions selector issue
- [ ] Server remains functional

---

## Notes

- Test page provides predictable elements for testing
- Some interactions require visible elements
- Timing may vary based on page performance
- Multiple actions execute atomically (all or none)
