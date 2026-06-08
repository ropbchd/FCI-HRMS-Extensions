Changelog — FCI Higher Studies Distance Assistant
All changes documented in reverse chronological order.
---
v1 — June 2026
Initial version
`content_list.js`: Passive listing page — closes attachment tab when returning from review.
`content.js`: Full stage detection and floating panel:
Stage 1: Last Dispatched = MAYURESH KUMAR, next = AMIT (Pending Review, N/A), Office ≠ RO CHANDIGARH → Add Reviewer → ABHIMANYU SWAMI
Stage 1B: Same as Stage 1 but Office = RO CHANDIGARH → Add Reviewer → Assistant (cadre/office routing)
Stage 1C: Last Reviewed = Assistant, ABHIMANYU not in history, Office = RO CHANDIGARH → Add Reviewer → ABHIMANYU SWAMI
Stage 2: Last Reviewed = ABHIMANYU SWAMI, next = AMIT (Pending Review, N/A) → Add Reviewer → Assistant (cadre/office routing)
Stage 3: MANUAL — floating panel with prerequisite checks, dynamic remark generation
Stage 3B: Assistant flagged issue → Add Reviewer → DO Manager (same as NOC Other Exam)
Stage 3C: DO reprocessed → Add Reviewer → Assistant (same as NOC Other Exam)
Floating panel features:
Prerequisite checkboxes: Admission brochure, Undertaking, Relevant circular
Warning if any checkbox unchecked before generating remark
S19 dropdown: NIL / 1 / 2 (default NIL)
R19 dropdown: NIL / 1 / 2 (default 2)
T19 text field: IPR Year (blank = omit sentence)
"Generate Final Approval Remark" button — builds dynamic remark with all conditions
"Send Back to DO (Stage 3B)" button — manual trigger
"Fill Remark" button — pushes generated text into #editor
Draggable panel with position saved via localStorage
Assistant clearance pattern detection:
Three hardcoded patterns for assistant remark validation
Lenient matching, case-insensitive
Extracts Sl. No. / Remark references for inclusion in final remark
Multiple matches or no match → prompts user with option to proceed with standard remark
Attachment handling:
Opens first "Attachment" link in background tab via background.js
Closes attachment tab on return to listing page
Safety features:
HISTUDIES prefix guard on all scripts
Trigger flag for Add Reviewer navigation
No auto-submission
Highlight trigger row before acting
Whitespace normalization on office comparisons
Files added: `manifest.json`, `content.js`, `content_add_reviewer.js`, `content_list.js`, `background.js`, `popup.html`, `CHANGELOG.md`
Known pending items:
Manager designation variants omitted (not receiving manager requests currently)
Hindi variant assistant remarks not handled
"Previously Sanctioned" table edge cases (multiple completed courses) — prompts user for now
Stage 1B and 1C not yet tested on live requests
