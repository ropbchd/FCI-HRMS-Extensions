# Changelog — FCI LTC Assistant

All changes documented in reverse chronological order.

---

## v1.1 — June 2026

**Fixes applied before first test:**

- **Fix 1 — manifest.json:** Added `/cb/` path segment to listing URL (`hrmsfci.in/cb/ltc-bharat-darshan-hometown/list`).
- **Fix 2 — content.js decideAssistant():** Changed cadre matching from `=== 'DEPOT'` to `.includes('DEPOT')` to handle "Depot Group 1" / "Depot Group 2" variants.
- **Fix 3 — content.js Stage 3 trigger:** Added guard `lastAssistantReviewed.remark.trim() !== '' && lastAssistantReviewed.remark.trim() !== 'N/A'` to prevent false Stage 3 triggers on empty remarks.
- **Fix 4 — content.js fillReviewerRemarks():** Changed textarea ID from `dop_member_comment` to `comments` to match portal's actual element ID.
- **Fix 5 — content.js buildDynamicRemark():** Added `scrapeLeaveFieldsFromPage()` function that auto-extracts leave days, type, from/to dates, and destination from Point 1 and Point 6 of the review page text using regex. Dialog fields are pre-populated with scraped values.
- **Fix 6 — content_ltc_list.js:** Review link is now found by matching `href.includes('/workflow/review/')` instead of relying on `a:first-child` position, which could pick the View (eye) icon instead of the Review icon.

**Improvements applied:**

- **Improvement A — Dialog UX:** Spouse Letter field is now hidden when Spouse Working = No, and shown only when Spouse Working = Yes.
- **Improvement B — Dialog validation:** Required fields (Date of Joining, Block Year, Employee Name, Designation, Cadre, Leave Days, Leave Type, From/To dates, Destination) are validated before generating the remark. Empty fields are highlighted in red for 3 seconds.
- **Improvement C — Stage 3C detection:** More robust detection: fires when the entry before the latest AMIT Pending Review is a non-assistant, non-dispatcher, non-manager employee who has Reviewed — indicating a DO-level employee sent the request back after Stage 3B.

---

## v1.0 — June 2026

**Initial version**

`content_ltc_list.js`: Auto-opens the first Pending Review request on the LTC listing page. Supports multiple table selectors as fallback since the exact DataTable ID was not confirmed at build time.

`content.js`: Full stage detection and floating panel:
- **Stage 1**: Last Dispatched = MAYURESH KUMAR, next = AMIT KUMAR SINGH (Pending Review, N/A) → Add Reviewer → Assistant (cadre/office routing: MADHU DHAKA / DIVYA KORNU / VISHALI MARWAHA)
- **Stage 3**: Last Reviewed = Assistant, next = AMIT KUMAR SINGH (Pending Review, N/A) → Shows floating panel with two options:
  - "Approve — Generate Remark": Opens a dialog with input fields for all remark variables (Date of Joining, Block Year, LTC availed in 2024/2025, Spouse working, Leave details, Destination, Leave approval status). Builds dynamic remark based on the Excel formula provided.
  - "Send Back (3B)": Routes to Stage 3B or 3B-RO based on office.
- **Stage 3B**: Assistant found issue, Office ≠ RO CHANDIGARH → Add Reviewer → DO Manager (entry before AGM with non-N/A remark)
- **Stage 3B-RO**: Assistant found issue, Office = RO CHANDIGARH → Add Reviewer → Request Initiating Employee (Entry #1 with "Initiated" action)
- **Stage 3C**: DO Manager has reprocessed and sent back → Add Reviewer → Assistant (cadre/office routing)

**Floating panel features:**
- Draggable header
- Two action buttons: Approve (green) and Send Back (red)
- Approve opens a comprehensive dialog with all input fields needed for the dynamic remark
- Dialog auto-populates fields read from the page (Date of Joining, Block Year, Employee Name, Designation, Cadre)
- User fills remaining fields (LTC availed, spouse details, leave details, destination, leave approval)
- "Generate Remark" button builds the full remark and fills #editor

**Attachment handling:**
- Opens all available attachments in background tabs via background.js
- Closes attachment tabs on return to listing page

**Safety features:**
- LBD prefix guard on all scripts
- Trigger flag for Add Reviewer navigation
- No auto-submission
- Highlight trigger row before acting
- Whitespace normalization on office comparisons

**Files added:** `manifest.json`, `content.js`, `content_add_reviewer.js`, `content_ltc_list.js`, `background.js`, `popup.html`, `CHANGELOG.md`

**Known pending items:**
- Stage 3B and 3B-RO not yet tested on live requests
- Stage 3C not yet tested on live requests
- The dynamic remark dialog may need refinement based on actual field values from live requests
- Hindi variant assistant remarks not handled
- Floating panel position is not persisted (no localStorage save)
