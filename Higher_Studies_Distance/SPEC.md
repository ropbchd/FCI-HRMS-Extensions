# SPEC — Higher Studies Distance

## Identity
- Name: FCI Higher Studies Distance Assistant
- Request ID prefix: HISTUDIES
- Folder: `extensions/higher-studies-distance/`
- Version: v1
- Architecture pattern: **A** (NOC / Workflow)
- Listing URL: `hrmsfci.in/er/higher-studies`
- Review URL pattern: `hrmsfci.in/workflow/review/<encoded-id>/<version>`
- Add Reviewer URL pattern: `hrmsfci.in/workflow/add-reviewer/<encoded-id>/<version>`

## Files
- `manifest.json`
- `content.js` — Review page script (stage detection + floating panel + dynamic remark)
- `content_add_reviewer.js` — Add Reviewer page script
- `content_list.js` — Listing page script (closes attachment tab on return)
- `background.js` — Service worker (background tab open + close)
- `popup.html`
- `icon.png`
- `CHANGELOG.md`

## What It Does (automatic steps)
1. **Listing page:** Passive — only closes attachment tab when returning from review.
2. **Review page:** Clicks "View Action History", parses table, detects stage. Automated stages (1, 1B, 1C, 2, 3B, 3C) navigate to Add Reviewer. Stage 3 shows floating panel for manual remark generation.
3. **Add Reviewer page:** Reads sessionStorage, fills Office Type + Office + Employee + Reason.

## Stage Detection

| Stage | Trigger | Action |
|---|---|---|
| **1** | Last Dispatched = MAYURESH KUMAR, Next = AMIT (Pending Review, N/A), Office ≠ RO CHANDIGARH | Add Reviewer → ABHIMANYU SWAMI. Remark: vigilance clearance. |
| **1B** | Same as Stage 1 but Office = RO CHANDIGARH, Cadre = GENERAL or DEPOT | Add Reviewer → Assistant (cadre/office routing). Remark: performa. |
| **1C** | Last Reviewed = Assistant, ABHIMANYU SWAMI not in history, Office = RO CHANDIGARH, Next = AMIT (Pending Review, N/A) | Add Reviewer → ABHIMANYU SWAMI. Remark: vigilance clearance. |
| **2** | Last Reviewed = ABHIMANYU SWAMI, Next = AMIT (Pending Review, N/A), Cadre = GENERAL or DEPOT | Add Reviewer → Assistant (cadre/office routing). Remark: admin clearance. |
| **3** | **MANUAL** — No auto-trigger. User clicks "Generate Final Approval Remark" in floating panel. | Fill Reviewer Remarks with dynamic remark. |
| **3B** | Last Reviewed = Assistant, remark not empty, Next = AMIT (Pending Review, N/A), Office ≠ RO CHANDIGARH | Add Reviewer → DO Manager (entry before AGM). |
| **3C** | DO Manager sent back, Entry before AMIT Pending Review = same DO Manager, Not in Stage 2/3B | Add Reviewer → Assistant (cadre/office routing). |

**Stage priority:** 3B → 3C → 2 → 1C → 1B → 1 → no match (inject floating panel for Stage 3)

## Assistant Routing

| Cadre | Office Group | Offices | Assistant | Emp No |
|---|---|---|---|---|
| GENERAL | Any | All offices | MADHU DHAKA | 313284 |
| DEPOT | Group 1 | RO CHANDIGARH, DO PATIALA, DO LUDHIANA, DO JALANDHAR, DO FARIDKOT, DO HOSHIARPUR, DO AMRITSAR | DIVYA KORNU | 315172 |
| DEPOT | Group 2 | DO KAPURTHALA, DO FEROZEPUR, DO CHANDIGARH, DO BHATINDA, DO MOGA, DO GURDASPUR, DO SANGRUR | VISHALI MARWAHA | 308235 |

## Preset Remarks

### Stage 1 / 1C
`With respect to the application made by the employee, kindly provide the vigilance clearance for the purpose of pursuing Higher Studies Distance.`

### Stage 1B
`Kindly provide the details as per the latest performa dt. 16.01.2025 provided by the ZO(N).`

### Stage 2
`Kindly review the submitted request for admin. clearance and check the eligibility with reference to the applicable circulars, rules, and policies of the Corporation to assess their alignment with the prescribed provisions.`

### Stage 3C
`Kindly re-examine the submitted request for admin. clearance and check the eligibility with reference to the applicable circulars, rules, and policies of the Corporation to assess their alignment with the prescribed provisions.`

### Stage 3B
`Reference may be made to the observations recorded during examination of the request at Sl. No. [X]. Required necessary clarifications and/or supporting documents, as indicated, may kindly be furnished for further processing.`
(where [X] = slNo of last assistant's reviewed entry)

## Stage 3 — Dynamic Remark (Manual)

**Trigger:** User clicks "Generate Final Approval Remark" button in floating panel.

**Prerequisite checks (checkboxes):**
1. Admission brochure attached?
2. Undertaking attached?
3. Relevant circular attached?

If any unchecked → warning dialog with option to continue anyway.

**User inputs:**
- S19: Dropdown `NIL` / `1` / `2`, default `NIL`
- R19: Dropdown `NIL` / `1` / `2`, default `2`
- T19: Text field, blank default (blank = omit IPR sentence)

**Fields read from page:**
- Name of Course, University, From Date, To Date, Type, Duration, Office, Designation, Cadre

**Assistant clearance pattern detection:**
Three hardcoded patterns scanned in last assistant's remark. If matched, extracts references (Sl. No. / Remark #) for inclusion. If multiple matches or no match → prompts user with option to proceed with standard remark (no references).

**Remark template:** See `content.js` `buildStage3Remark()` function for full conditional logic.

## Floating Panel Features
- Draggable header with position saved to localStorage
- Shows employee name in header
- Prerequisite checkboxes with warning on unchecked
- Generate button (green), Send Back to DO button (red), Fill button (green), Clear button (secondary)
- Preview area showing generated remark
- Auto-scroll to Reviewer Remarks editor after filling

## sessionStorage Keys

| Key | Purpose |
|---|---|
| fci_hs_triggered | Safety flag — "yes" = extension triggered Add Reviewer |
| fci_hs_stage | Stage detected: "1", "1b", "1c", "2", "3b", "3c" |
| fci_hs_office_type | Office Type value: "4" (RO) or "5" (DO) |
| fci_hs_assistant_emp | Emp number (RO-level employees) |
| fci_hs_assistant_name | Employee name (for logging) |
| fci_hs_assistant_remark | Remark text for Reason field |
| fci_hs_target_office | DO office name (Stage 3B only) |
| fci_hs_target_employee_name | DO employee name (Stage 3B only) |
| hs_attachment_tab_id | Attachment tab ID for closing |
| hs_attachment_opened_<requestId> | Flag to prevent re-opening |
| hs_panel_pos | Saved panel position (localStorage) |

## Known Issues / Pending
- Manager designation variants omitted (not receiving manager requests)
- Hindi variant assistant remarks not handled
- Stage 1B and 1C not yet tested on live requests
- "Previously Sanctioned" table edge case: multiple completed courses prompts user
- IPR Year field not visible on page — manual input only

## Version History
- v1 (June 2026) — Initial release based on NOC Other Examination v4 and Employee Profile Update v1.2 patterns
