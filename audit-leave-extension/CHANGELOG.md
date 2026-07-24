# Changelog — FCI Audit Leave Assistant

All changes documented in reverse chronological order.

---

## v1 — July 2026

**Initial version**

`content\_list.js`: Listing page automation:
- Auto-changes "Show" dropdown from 10 to 100 entries
- Scans for actionable requests (rows with eye button, not already approved)
- Captures employee data: Name, Number, Designation, Cadre, Office, Request ID
- Stores data in sessionStorage for review page
- Opens first actionable request's review page

`content\_audit\_leave.js`: Review page automation:
- `isAuditLeavePage()` — detects page by Leave Account Table (distinctive columns)
- Auto-clicks "View Action History"
- Parses action history entries (handles remarks, attachments)
- Stage detection: initial_review, re_review_needed, final_approval, return_to_do, unknown
- Floating panel with:
  - Employee info from listing page
  - Stage badge with color coding
  - Approve remarks (3 options)
  - Objection/Reject remarks (3 options)
  - Return to DO remarks (2 options)
  - Preview area
  - "Fill remark" button
  - Drag-to-reposition (position saved in localStorage)
- Attachment handling: opens in background tab

`content\_add\_reviewer.js`: Add Reviewer page automation:
- Safety: Audit Leave page check + trigger flag
- Reads routing data from sessionStorage
- Goes to last page of action history
- Fills cascading dropdowns: Office Type → Office → Employee
- Fills Reason field

`background.js`: Service worker for background tab operations

`popup.html`: Extension info

**Key features:**
- No Request ID needed — uses Leave Account Table as page identifier
- Data retention from listing page to review page
- Stage-aware panel (different remark sections per stage)
- Drag-to-reposition with saved position

**Known pending items:**
- Stage 1B (RO CHANDIGARH variant) — not implemented yet
- Stage 3C (DO reprocessed) — not implemented yet
- Hindi remark handling — basic, could be improved
