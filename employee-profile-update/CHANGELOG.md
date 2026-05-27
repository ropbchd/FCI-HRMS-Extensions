# Changelog — FCI Employee Profile Update Assistant

## v1.0 — May 2026

### Initial release

**Approve page (`/corehr/transaction/profile-request/approve/*`):**
- Safety check: extension only activates on requests with `RHR` prefix
- Auto-clicks the **Update** tab on page load
- Auto-opens the **Attachment** ("view" link) in a new tab on page load
- Stores the attachment tab ID for later auto-closure
- Injects a draggable **floating panel** with:
  - 3 Approve remarks (green)
  - 3 Reject remarks (red)
  - Remark preview area
  - "Fill remark" button → pushes selected text into `#dop_member_comment`
- Officer reviews, fills fields manually if required, then clicks Approve/Reject + OK

**Listing page (`/corehr/transaction/profile-request`):**
- On return after request disposal, auto-closes the attachment tab that was opened

### Known limitations / pending
- Remarks list is intentionally kept to 6 entries (v1.0). More remarks to be added in future versions.
- Attachment tab closing relies on the tab being the most recently opened tab at time of approve page load.
