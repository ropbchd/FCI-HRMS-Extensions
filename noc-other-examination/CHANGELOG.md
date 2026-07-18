Changelog — NOC For Other Examination Extension

All changes to this extension are documented here in reverse chronological order.

v4.4 — July 2026 (Current) — COMPLETE

New feature: BALJIT-Centric Two-Factor Vigilance Gate

Problem: Stage 3 (approval) was triggering when an assistant's remark contained "in order" even if BALJIT SINGH's vigilance remark indicated the employee was NOT clear. This caused false-positive approvals.

Solution: Re-architected Stage 3/3E detection to use BALJIT SINGH's remark as the pole point (authoritative source), with the assistant's remark as the secondary check.

BALJIT "Clear" Detection: Uses BALJIT's standard Hindi phrase सतर्कतादृष्टिकोणसेमुक्तहै (whitespace-normalized) to confirm vigilance clearance.

BALJIT "Not Clear" Detection: Uses existing STAGE3E_VIGILANCE_KEYWORDS array (UNDER CONTEMPLATION, NOT CLEAR, PENDING, etc.).

Sync Gate Matrix (BALJIT as Pole Point):

| BALJIT Says | Assistant "in order"? | Result | Action |
|---|---|---|---|
| CLEAR | YES | Stage 3 ✅ | Fill approval remark |
| CLEAR | NO | 🔴 MISMATCH | Highlight both rows, NO action |
| NOT CLEAR | NO | Stage 3E ✅ | Fill rejection remark |
| NOT CLEAR | YES | 🔴 MISMATCH | Send back to Assistant with correction remark |

Mismatch handling:
- BALJIT CLEAR + Assistant NOT "in order": Both rows highlighted (BALJIT red, Assistant orange), no auto-action. Manual review required.
- BALJIT NOT CLEAR + Assistant "in order": Routes back to the same assistant with remark: "Kindly re-examine the request. As per vigilance records, the concerned employee is not vigilance free."
- BALJIT ambiguous (present but unclear): Treated as mismatch, both rows highlighted, no auto-action.
- BALJIT missing (never reviewed): NOT treated as mismatch — normal Stage 3B/3D routing proceeds.

Fixes applied in v4.4:
- Fix 6 (CRITICAL): Multi-page pagination — content.js now collects ALL pages of action history before stage detection. Prevents stage detection failure on requests with >10 entries.
- Fix 3: Manifest updated with both www and non-www domains in all matches and host_permissions.
- Fix 1: Mismatch guard — mismatchClear excludes post-performa cases (isPostPerformaFlag).
- Fix 5: 3Mismatch handler added in content_add_reviewer.js alongside 3D (RO-based, select employee by name).
- Fix 4: Stage guards — 3b/3d/3c explicitly exclude all mismatch cases (mismatchNotClear, mismatchClear, mismatchAmbiguous).
- Fix 2: Chrome profile isolation explained to user (user-side action for extension interference).

Highlight colors: BALJIT row = red border (#cc0000), Assistant row = orange border (#ff6600) for visual distinction.

Files changed: content.js, content_add_reviewer.js, manifest.json, CHANGELOG.md

---

v4.3 — July 2026

New feature: Stage 3D — RO CHANDIGARH Assistant Clarification Routing

Added Stage 3D to handle RO CHANDIGARH requests where an assistant finds an issue and needs clarifications.

Trigger: Last Reviewed = Assistant (MADHU DHAKA / DIVYA KORNU / VISHALI MARWAHA), Assistant's remark does NOT contain "in order" key sentence, Next = AMIT KUMAR SINGH (Pending Review, N/A), Office = RO CHANDIGARH.

Action: Sends the request back to the Initiating Official (S.No. 1 in action history) with a clarification remark referencing the assistant's observations.

Office Type: RO (value "4")

Target Office: RO CHANDIGARH

Priority order updated: Stage 3 → Stage 3E → Stage 3B → Stage 3D → Stage 3C → Stage 1D → Stage 2 → Stage 1C → Stage 1B → Stage 1

Files changed: content.js, content_add_reviewer.js

v4.2 — July 2026

Bug fix: Stage 3 detection — whitespace-insensitive key sentence matching

Fixed a critical bug where Stage 3 failed to trigger because the portal stores remarks with inconsistent whitespace (e.g., "policies,circulars,and" vs "policies, circulars, and").

The key sentence is now normalized to remove all whitespace variations before comparison, making detection robust against any whitespace formatting differences.

This prevents false-positive Stage 3B triggers when an assistant has actually confirmed the request is "in order".

The key sentence constant is normalized once at definition for better performance and maintainability.

Files changed: content.js

v4.1 — June 2026

New feature: Stage 1C — Post-performa vigilance routing

Added Stage 1C to handle the workflow state where the assistant (DIVYA KORNU / MADHU DHAKA / VISHALI MARWAHA) has completed the performa attachment and the request returns to AMIT KUMAR SINGH as Pending Review + N/A.

Trigger: Last Reviewed = assistant, next = AMIT KUMAR SINGH (Pending Review, N/A), AND ABHIMANYU SWAMI has NOT yet reviewed (no entry in action history), AND Office = RO CHANDIGARH.

Action: Sends the request to ABHIMANYU SWAMI (empNo: 276695) for vigilance clearance with the same remark as Stage 1.

Key guard: The isAbhimanyuInHistory() helper scans all action history entries to ensure ABHIMANYU SWAMI has not already reviewed. This prevents false positives when an assistant raises an objection during Stage 2 (admin clearance), where ABHIMANYU SWAMI's entry already exists.

Priority order updated: Stage 3 → Stage 3B → Stage 3C → Stage 2 → Stage 1C → Stage 1B → Stage 1.

content_add_reviewer.js requires no changes — Stage 1C uses the same sessionStorage pattern as Stage 1 (select by emp number, not by name).

Files changed: content.js

v3 — May 2026

Bug fix: Office name whitespace normalisation

Fixed a critical bug where the extension failed to route Stage 2 requests for offices like "DO CHANDIGARH" because the portal stores office names with double spaces (e.g. "DO  CHANDIGARH") which did not match the single-spaced entries in the office lists.

Applied .trim().replace(/\s+/g, ' ') normalisation at all four office comparison points: isRoChandigarh check, cadre/office read in decideAssistant(), and both DIVYA and VISHALI office list comparisons.

This fix also future-proofs against tabs or non-breaking spaces in office names.

Files changed: content.js

v2 — May 2026

Safety: Request type guard added to all three scripts

Added Request ID prefix check (NOE) at the entry point of all three content scripts.

Extension now stays completely silent on any request type other than NOC For Other Examination, even if those pages share the same URL pattern.

content_noc_list.js: reads Request ID from table row before clicking Review; aborts if not NOE.

content.js: getRequestId() function scans page elements and body text; activation only proceeds on confirmed NOE prefix.

content_add_reviewer.js: body text search for NOE prefix at the very start; returns immediately if not found.

Files changed: content_noc_list.js, content.js, content_add_reviewer.js

New feature: Stage 3

Added Stage 3 detection: triggers when the last Reviewed entry is one of the three assistants (MADHU DHAKA / DIVYA KORNU / VISHALI MARWAHA), the next entry is AMIT KUMAR SINGH with Pending Review + N/A remark, and the assistant's remark contains the key sentence confirming the request is in order.

Action: fills the Reviewer Remarks box directly on the Review Page without navigating to Add Reviewer.

Two remark variants: one for RO CHANDIGARH requests, one for all other offices.

Stage priority order is now: Stage 3 → Stage 2 → Stage 1B → Stage 1 → No action.

Files changed: content.js

v1 — May 2026

Initial working version

content_noc_list.js: auto-opens the first Pending Review request on the NOC For Other Examination listing page.

content.js: reads action history, detects Stage 1 (send to ABHIMANYU SWAMI for vigilance clearance), Stage 1B (RO CHANDIGARH variant — send to relevant assistant with performa remark), and Stage 2 (send to assistant for admin clearance based on Cadre and Office routing table).

content_add_reviewer.js: fills Office Type, Office, and Reason on the Add Reviewer page using sessionStorage handoff from content.js.

Safety features: trigger flag, no auto-submission, no-match = no action, highlight before acting.

Assistant routing: MADHU DHAKA (General cadre), DIVYA KORNU (Depot + Group 1 offices), VISHALI MARWAHA (Depot + Group 2 offices).

Files added: all four files (manifest.json, content_noc_list.js, content.js, content_add_reviewer.js)