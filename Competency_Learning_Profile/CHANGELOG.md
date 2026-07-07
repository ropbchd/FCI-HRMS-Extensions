# Changelog — FCI CALP Assistant

## v1.0 — June 2026

### Initial release

**Stage 1 (Send to assistant for review):**
- Trigger: Last Dispatched = MAYURESH KUMAR, next = AMIT KUMAR SINGH (Pending Review, N/A)
- Action: Navigate to Add Reviewer → route to assistant per cadre/office routing (same as NOC extensions)
- Remark: "For examination and review remark plz."

**Stage 2 (Approve/Reject):**
- Trigger: Last Reviewed = one of the three assistants, next = AMIT KUMAR SINGH (Pending Review, N/A)
- Action: Open "Attachment" link in background tab + inject floating remark panel
- Floating panel: 3 Approve remarks + 3 Reject remarks (same as EPU extension)
- Officer fills remark via panel, then clicks Approve/Reject manually

**Listing page:**
- On return after disposal, auto-closes the attachment tab

**Safety features:**
- CALP prefix guard on all three scripts
- sessionStorage trigger flag prevents manual Add Reviewer activation
- No auto-submission — officer always clicks the final button
- Highlight trigger row before acting

### Known pending items
- Remark field is a rich text editor — filled via #editor (innerText). Verify on first live Stage 2 request.
- Cadre/office field selectors depend on page structure — if field reading fails, check getFieldValue() in content_approve.js.
