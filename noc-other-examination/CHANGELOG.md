# Changelog — NOC For Other Examination Extension

All changes to this extension are documented here in reverse chronological order.

---

## v3 — May 2026 (Current)

**Bug fix: Office name whitespace normalisation**

- Fixed a critical bug where the extension failed to route Stage 2 requests for offices like "DO CHANDIGARH" because the portal stores office names with double spaces (e.g. "DO  CHANDIGARH") which did not match the single-spaced entries in the office lists.
- Applied `.trim().replace(/\s+/g, ' ')` normalisation at all four office comparison points: `isRoChandigarh` check, cadre/office read in `decideAssistant()`, and both DIVYA and VISHALI office list comparisons.
- This fix also future-proofs against tabs or non-breaking spaces in office names.

**Files changed:** `content.js`

---

## v2 — May 2026

**Safety: Request type guard added to all three scripts**

- Added Request ID prefix check (`NOE`) at the entry point of all three content scripts.
- Extension now stays completely silent on any request type other than NOC For Other Examination, even if those pages share the same URL pattern.
- `content_noc_list.js`: reads Request ID from table row before clicking Review; aborts if not NOE.
- `content.js`: `getRequestId()` function scans page elements and body text; activation only proceeds on confirmed NOE prefix.
- `content_add_reviewer.js`: body text search for NOE prefix at the very start; returns immediately if not found.

**Files changed:** `content_noc_list.js`, `content.js`, `content_add_reviewer.js`

**New feature: Stage 3**

- Added Stage 3 detection: triggers when the last Reviewed entry is one of the three assistants (MADHU DHAKA / DIVYA KORNU / VISHALI MARWAHA), the next entry is AMIT KUMAR SINGH with Pending Review + N/A remark, and the assistant's remark contains the key sentence confirming the request is in order.
- Action: fills the Reviewer Remarks box directly on the Review Page without navigating to Add Reviewer.
- Two remark variants: one for RO CHANDIGARH requests, one for all other offices.
- Stage priority order is now: Stage 3 → Stage 2 → Stage 1B → Stage 1 → No action.

**Files changed:** `content.js`

---

## v1 — May 2026

**Initial working version**

- `content_noc_list.js`: auto-opens the first Pending Review request on the NOC For Other Examination listing page.
- `content.js`: reads action history, detects Stage 1 (send to ABHIMANYU SWAMI for vigilance clearance), Stage 1B (RO CHANDIGARH variant — send to relevant assistant with performa remark), and Stage 2 (send to assistant for admin clearance based on Cadre and Office routing table).
- `content_add_reviewer.js`: fills Office Type, Office, Employee, and Reason on the Add Reviewer page using sessionStorage handoff from content.js.
- Safety features: trigger flag, no auto-submission, no-match = no action, highlight before acting.
- Assistant routing: MADHU DHAKA (General cadre), DIVYA KORNU (Depot + Group 1 offices), VISHALI MARWAHA (Depot + Group 2 offices).

**Files added:** all four files (`manifest.json`, `content_noc_list.js`, `content.js`, `content_add_reviewer.js`)
