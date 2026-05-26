Changelog — NOC Passport Extension
All changes to this extension are documented here in reverse chronological order.
---
v1 — May 2026
Initial version
`content_passport_list.js`: auto-opens the first Pending Review request on the NOC Passport listing page.
`content.js`: reads action history, detects and handles four stages:
Stage 1 — Last Dispatched = MAYURESH KUMAR, next = AMIT KUMAR SINGH (Pending Review, N/A): adds ABHIMANYU SWAMI as reviewer for vigilance clearance. Remark text varies by Passport Application type (New / Renewal).
Stage 1B — Same trigger as Stage 1 but Office = RO CHANDIGARH: routes to relevant assistant (cadre/office routing) with performa remark. Code implemented but not yet tested on a live request.
Stage 2 — Last Reviewed = ABHIMANYU SWAMI, next = AMIT KUMAR SINGH (Pending Review, N/A): routes to assistant for admin clearance per cadre/office routing table. Remark text varies by Passport Application type.
Stage 3 — Last Reviewed = one of the three assistants, next = AMIT KUMAR SINGH (Pending Review, N/A): fills Reviewer Remarks directly on the Review page with dynamic remark (employee name, designation, cadre, office, and New/Renewal phrase all inserted from page fields). Also attempts to open Annexure H attachment automatically (scans for "Annex" in link text/href; if not found opens all available attachments).
`content_add_reviewer.js`: fills Office Type, Office, Employee, and Reason on the Add Reviewer page using sessionStorage handoff from content.js.
Safety features: NOCPASS prefix guard on all three scripts, trigger flag, no auto-submission, no-match = no action, highlight before acting, whitespace normalisation on office comparisons.
Stage priority order: Stage 3 → Stage 2 → Stage 1B → Stage 1 → No action.
Known pending items:
Stage 1B: code complete but untested — no live RO CHANDIGARH Stage 1B request was available at build time.
The table ID on the listing page (`#passportTable`) must be verified by inspecting the live page — update `content_passport_list.js` if different.
The `label[for]` attribute values for `employee_name`, `designation`, `cadre`, `office`, and `passport_application` fields must be verified on the live Review page. Fallback logic is in place but confirming the exact IDs will make field reading more robust.
Files added: `manifest.json`, `content_passport_list.js`, `content.js`, `content_add_reviewer.js`, `popup.html`, `CHANGELOG.md`
