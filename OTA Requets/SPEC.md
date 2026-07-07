# SPEC — OTA Request

## Identity
- Name: FCI OTA Request Assistant
- Request ID prefix: CBO
- Folder: `Ota-Request/`
- Version: v1
- Architecture pattern: **B** (single-stage, in-page fill, no Add Reviewer hop)
- Listing URL: `hrmsfci.in/cb/transactions/ota_request/list`
- Review URL pattern: `hrmsfci.in/workflow/review/<encoded-id>/<version>`

## Files
- `manifest.json`
- `content.js` — Review page script (trigger detection + in-page fill)
- `content_ota_list.js` — Listing page script (opens first pending row)
- `popup.html`
- `icon.png`
- `CHANGELOG.md`

## What It Does (automatic steps)
1. **Listing page:** Opens the Review link of the first row (CBO prefix check).
2. **Review page:** Clicks "View Action History", parses table, checks trigger.
   If matched, fills Multiplication Factor, prerequisite checkboxes, and
   Reviewer Remarks directly on this page. No navigation, no auto-submit.

## Stage (single stage, no branching)

| Condition | Detail |
|---|---|
| Last Dispatched | MAYURESH KUMAR |
| Next entry | AMIT KUMAR SINGH — Action: Pending Review — Remark: N/A |
| Employee Number | Must be present in `CADRE_LOOKUP` (else: no action) |

**Action:**
1. Set `#multiplication_factor_1` to `1.1`, dispatch `input`/`change`.
2. Click header checkbox `input[name="select_multiplication_factor"]` to
   propagate `1.1` to all rows (only if not already checked).
3. Check all 3 prerequisite checkboxes (register entries / period checked
   / person earned OT) via text-matching.
4. Build and fill Reviewer Remarks (`#editor`) with the dynamic template
   below.
5. Stop. Officer reviews and clicks "Review" manually.

## Cadre Lookup Table

| Employee Number | Employee Name | Cadre |
|---|---|---|
| 286357 | RISHIKESH MISHRA | General |
| 315595 | SAMYAK NILKANTH MESHRAM | Depot |

Any employee number not in this table → extension stays silent, no action.

## Reviewer Remark Template

```
Sir, kindly find the reference to the supporting document attached by the
requesting employee, the OTA claimed has also been verified by the D.G.M
(R). Details of the OTA claim have been recorded separately. With regard
to the Multiplication Factor, it is submitted that, as per Section 03 of
The Punjab Shops and Commercial Establishments Act, 1958 (copy enclosed),
the provisions of the said Act are not applicable to offices of or under
the Central or State Governments, (except in the case of commercial
undertakings), also accordingly, as per the relevant FCI OTA Circular
(copy enclosed), the multiplication factor of 1.1 times of the hourly
normal wage is applicable at exempted locations. In view of above, OTA
claim of Sh. {Employee Name}, {Designation} ({Cadre}), calculated with a
multiplication factor of 1.1 for the verified {Admissible OTA Hours}
hours, may please be sanctioned.
```

Placeholders:
- `{Employee Name}` — from "Employee Name" field on review page
- `{Designation}` — from "Designation" field on review page
- `{Cadre}` — from `CADRE_LOOKUP` (General / Depot)
- `{Admissible OTA Hours}` — from "Admissible OTA Hours" field, kept in
  HH:MM format (not converted to decimal)

## Key Page Element References

| Element | Selector |
|---|---|
| Per-row Multiplication Factor dropdown | `#multiplication_factor_<S.No.>` (plain `<select>`, options: `Select` / `1` / `1.1`) |
| Header "apply to all rows" checkbox | `input[type="checkbox"][name="select_multiplication_factor"]` |
| Reviewer Remarks editor | `#editor` (contenteditable), mirrored to `#dop_member_comment` |
| Action history table | `#custom-action-history-tbl tbody` |

## Known Issues / Pending
- Listing page table selector unverified live.
- Prerequisite checkbox text-matching unverified live.
- Admissible OTA Hours field reading unverified live (exact DOM structure
  around the label not yet inspected).
- Google Sheets register write-back — deferred "good to have" feature.

## Version History
- v1 (June 2026) — Initial release, single-stage pattern, based on
  technical conventions established in NOC For Other Examination and
  Higher Studies Distance extensions.
