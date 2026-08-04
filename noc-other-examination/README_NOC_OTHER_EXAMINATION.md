# NOC For Other Examination --- Extension README

**Request Type:** NOC For Other Examination\
**Request ID Prefix:** `NOE`\
**Folder:** `noc-other-examination/`\
**Current Version:** v5.0 (Floating Window Framework)\
**Portal URL:** hrmsfci.in\
**Listing Page:** `hrmsfci.in/er/noc/other-examination`

------------------------------------------------------------------------

## Purpose

This extension automates workflow processing for NOC For Other
Examination requests on the FCI HRMS portal. It reads the action history
of each request, determines the correct next step, and fills the Add
Reviewer form or Reviewer Remarks box automatically. The officer always
performs the final submission manually.

As of v5.0, the extension also renders a floating panel (shared
Floating Window Framework, see `Floating_Window_Architecture.md`) on
both the Review page and the Add Reviewer page, showing the detected
recommendation and offering two alternative actions --- **Re-examine**
and **Return to Previous Level** --- that the officer can choose instead
of the automatically detected action.

------------------------------------------------------------------------

## Files

  -----------------------------------------------------------------------
  File                                Purpose
  ----------------------------------- -----------------------------------
  `manifest.json`                     Extension identity, permissions,
                                      URL-to-script mapping

  `content_noc_list.js`               Listing page --- auto-opens the
                                      first pending NOE request

  `content.js`                        Review page --- detects stage and
                                      acts (single source of truth for
                                      all routing logic). Also exposes
                                      `window.FCIWorkflow` (Floating
                                      Window bridge) and precomputes
                                      alternative-action payloads.

  `content_add_reviewer.js`           Add Reviewer page --- reads
                                      sessionStorage and fills the form.
                                      Contains no stage-detection logic,
                                      but does implement its own
                                      `window.FCIWorkflow` bridge variant
                                      and the live in-place payload
                                      switcher.

  `floating_window.js`                Shared floating panel logic
                                      (workflow-agnostic). Calls
                                      `window.FCIWorkflow` on whichever
                                      page it's injected into.

  `floating_window.css`               Shared floating panel styling.
                                      Injected declaratively via
                                      `manifest.json`.

  `popup.html`                        Extension popup (status display)

  `icon.png`                          Extension icon

  `CHANGELOG.md`                      Version history
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## How to Use This README as a Handover Prompt

When starting a new chat session to continue work on this extension,
paste the following as your first message and attach the current
extension files:

------------------------------------------------------------------------

> We are continuing work on the FCI HRMS Chrome Extension project. The
> extension is for **NOC For Other Examination** requests (prefix:
> `NOE`), running on hrmsfci.in.
>
> Please read this README completely before doing anything. Then read
> the attached files: - `content.js` --- the main review page script
> (all routing logic + Floating Window bridge lives here) -
> `content_add_reviewer.js` --- the Add Reviewer page script (form
> filling + its own Floating Window bridge variant) - `floating_window.js`
> / `floating_window.css` --- shared panel framework, workflow-agnostic -
> `CHANGELOG.md` --- version history
>
> **Your role is technical consultant.** Do not write or modify any code
> without my explicit consent. Discuss, confirm understanding, propose
> --- then act only when I say yes.
>
> Once you have read everything, confirm your understanding of the
> current state and ask me what I want to work on.

------------------------------------------------------------------------

## Architecture

### Two-Script Design

**`content.js`** is the single source of truth. For every stage it
explicitly sets all seven sessionStorage keys before navigating to the
Add Reviewer page:

  -----------------------------------------------------------------------
  sessionStorage Key                  Purpose
  ----------------------------------- -----------------------------------
  `fci_noc_triggered`                 Safety flag --- Add Reviewer script
                                      only runs if this is `"yes"`

  `fci_noc_stage`                     Stage detected: `"1"`, `"1b"`,
                                      `"1c"`, `"1d-ro"`, `"1d-do"`,
                                      `"2"`, `"3b"`, `"3c"`, `"3d"`,
                                      `"3e"`, `"3mismatch"`

  `fci_noc_office_type`               Office Type value for
                                      `#filter_office_type`: `"4"` (RO)
                                      or `"5"` (DO)

  `fci_noc_target_office`             Office name to select (always
                                      explicit --- never inferred)

  `fci_noc_assistant_emp`             Employee number (for RO-level
                                      employees matched by emp number in
                                      option text)

  `fci_noc_assistant_name`            Employee name (fallback if emp
                                      number not found in option text)

  `fci_noc_target_employee_name`      Employee name for name-based
                                      selection (DO-level employees ---
                                      stages 3B, 3D, 3Mismatch, 1D
                                      variants)

  `fci_noc_assistant_remark`          Remark text to fill in the Reason
                                      field
  -----------------------------------------------------------------------

**`content_add_reviewer.js`** contains no stage-detection logic. It
simply: 1. Reads the stored values 2. Selects Office Type 3. Selects
Office (if `target_office` is set) 4. Fills the Reason/Remark field 5.
Selects Employee --- data-driven: - If `assistant_emp` set → search
option text for emp number, fallback to name - If only
`target_employee_name` set → search option text for name - If both set →
warn and use `assistant_emp` (signals a bug in `content.js`)

### Floating Window Bridge (v5.0)

`content.js` also writes a second, parallel namespace of sessionStorage
keys (`fp.*`) alongside the seven legacy keys above --- a compatibility
adapter, not a replacement. Both are written on every stage match, so
`content_add_reviewer.js` can read either.

  -----------------------------------------------------------------------
  sessionStorage Key                        Purpose
  ------------------------------------------ ----------------------------
  `fp.chosen`                                Which payload is active:
                                              `"recommended"`,
                                              `"reexamine"`, or
                                              `"returnprevious"`

  `fp.route.<chosen>.name`                   Target employee name

  `fp.route.<chosen>.emp`                    Target employee number
                                              (RO-level only; omitted for
                                              name-based selection)

  `fp.route.<chosen>.office`                 Target office name

  `fp.route.<chosen>.officeType`             Office Type value (`"4"`
                                              RO / `"5"` DO)

  `fp.remark.<chosen>`                       Remark text for the chosen
                                              action
  -----------------------------------------------------------------------

**`content.js`** exposes `window.FCIWorkflow`:

-   `getWorkflowContext()` --- returns `{ requestId, hasRecommendation,
    recommendedSummary }`, read by the panel to render the current
    detected stage.
-   `executeReExamine()` / `executeReturnPrevious()` --- write the
    corresponding `fp.*` keys from a precomputed payload and navigate to
    Add Reviewer, overriding whatever the automatic detection would have
    done.

All three payloads (`recommended`, `reexamine`, `returnprevious`) are
precomputed **once per page load**, unconditionally, before the
priority-order stage-detection chain runs --- not per-branch. This
keeps `getDoManagerEntry()` and the assistant/initiating-official
lookups as single-source-of-truth helpers rather than logic duplicated
per stage.

**`content_add_reviewer.js`** exposes its own `window.FCIWorkflow`
variant (different page, different context, same interface shape):

-   `getWorkflowContext()` --- reports what's currently filled in the
    form (`"Currently filling as: <label> --- routing to <name>"`),
    not a fresh recommendation.
-   `executeReExamine()` / `executeReturnPrevious()` --- call an
    internal `switchPayload()` that re-reads the corresponding `fp.*`
    keys and **re-fills the form in place**, even if the automatic
    fill (via `fp.chosen = "recommended"`) has already completed. This
    lets the officer change their mind after landing on the Add
    Reviewer page, not just before.

If `fp.chosen` / the matching `fp.route.*` keys are missing (e.g. an
older page load before this version), `content_add_reviewer.js` falls
back to reading the legacy `fci_noc_*` keys directly.

### Office Type Dropdown Values (`#filter_office_type`)

  Label                    `value=`
  ------------------------ ----------
  Depot                    `6`
  DO (Divisional Office)   `5`
  HQ                       `1`
  IFS                      `2`
  RO (Regional Office)     `4`
  ZO                       `3`

------------------------------------------------------------------------

## Key People

  -----------------------------------------------------------------------
  Name                    Emp No.                 Role
  ----------------------- ----------------------- -----------------------
  MAYURESH KUMAR          313929                  Dispatcher at RO
                                                  CHANDIGARH --- his
                                                  Dispatched entry
                                                  triggers Stage 1

  AMIT KUMAR SINGH        276670                  Manager (Personnel) ---
                                                  his Pending Review +
                                                  N/A entry is the
                                                  confirmation condition
                                                  for all stages

  ABHIMANYU SWAMI         276695                  Manager --- Stage 1 /
                                                  1C recipient (vigilance
                                                  clearance). His
                                                  Reviewed entry triggers
                                                  Stage 2

  BALJIT SINGH            ---                     VCC Records proxy ---
                                                  his remark is the "pole
                                                  point" for vigilance
                                                  status determination

  MADHU DHAKA             313284                  Assistant --- handles
                                                  General cadre (Stages
                                                  1B, 2, 3C)

  DIVYA KORNU             315172                  Assistant --- handles
                                                  Depot cadre, Group 1
                                                  offices (Stages 1B, 2,
                                                  3C)

  VISHALI MARWAHA         308235                  Assistant --- handles
                                                  Depot cadre, Group 2
                                                  offices (Stages 1B, 2,
                                                  3C)
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## Assistant Routing Groups

  -----------------------------------------------------------------------
  Cadre             Group             Offices           Assigned
                                                        Assistant
  ----------------- ----------------- ----------------- -----------------
  General           Any               All offices       MADHU DHAKA

  Depot             Group 1           RO CHANDIGARH, DO DIVYA KORNU
                                      PATIALA, DO       
                                      LUDHIANA, DO      
                                      JALANDHAR, DO     
                                      FARIDKOT, DO      
                                      HOSHIARPUR, DO    
                                      AMRITSAR          

  Depot             Group 2           DO KAPURTHALA, DO VISHALI MARWAHA
                                      FEROZEPUR, DO     
                                      CHANDIGARH, DO    
                                      BHATINDA, DO      
                                      MOGA, DO          
                                      GURDASPUR, DO     
                                      SANGRUR           
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## BALJIT SINGH --- The Pole Point

BALJIT SINGH's entry in the action history is the definitive indicator
of vigilance status. The extension reads his remark and classifies it:

  -------------------------------------------------------------------------
  Status                  Meaning                 How detected
  ----------------------- ----------------------- -------------------------
  `clear`                 Vigilance clear         Remark contains the
                                                  standard Hindi phrase
                                                  (whitespace-normalised)

  `notclear`              Vigilance issue exists  Remark contains keywords:
                                                  PENDING, INVOLVED, UNDER
                                                  CONTEMPLATION, NOT FREE,
                                                  NOT CLEAR etc.

  `ambiguous`             Present but unclear     Remark doesn't match
                                                  either pattern

  `missing`               Never reviewed          No BALJIT entry in
                                                  history --- NOT treated
                                                  as mismatch
  -------------------------------------------------------------------------

------------------------------------------------------------------------

## Stages --- Complete Reference

Stage priority order (first match wins):\
**3E → 3 → MismatchNotClear → MismatchClear → MismatchAmbiguous → 3B →
3D → 3C → 1D → 2 → 1C → 1B → 1 → no match**

### Stage 1 --- Send to ABHIMANYU SWAMI (vigilance clearance)

-   **Trigger:** Last Dispatched = MAYURESH KUMAR + next = AMIT (Pending
    Review, N/A) + office ≠ RO CHANDIGARH
-   **Action:** Add Reviewer → ABHIMANYU SWAMI (276695)
-   **Remark:**
    `With respect to the application made by the employee, kindly provide the vigilance clearance for the purpose of NOC for other exam.`
-   **Office set:** RO CHANDIGARH

### Stage 1B --- Performa request (RO CHANDIGARH variant)

-   **Trigger:** Same as Stage 1 BUT office = RO CHANDIGARH
-   **Action:** Add Reviewer → correct assistant (cadre/office routing)
-   **Remark:**
    `Kindly provide the details as per the performa provided by the FCI, Zonal Office (N).`
-   **Office set:** RO CHANDIGARH

### Stage 1C --- Send to ABHIMANYU after performa

-   **Trigger:** Last assistant reviewed + review follows a performa
    request (AMIT's preceding remark contains performa text) + ABHIMANYU
    has NOT yet reviewed + office = RO CHANDIGARH + next = AMIT (Pending
    Review, N/A)
-   **Action:** Add Reviewer → ABHIMANYU SWAMI (276695)
-   **Remark:** Same as Stage 1
-   **Office set:** RO CHANDIGARH

### Stage 1D --- Technical Error Handler

-   **Trigger:** An entry with a technical error keyword (attachments
    not accessible etc.) exists, followed by ABHIMANYU SWAMI's review,
    followed by AMIT (Pending Review, N/A)
-   **Action (RO):** Add Reviewer → initiating employee with re-upload
    request remark
-   **Action (DO):** Add Reviewer → DO Manager with re-upload request
    remark
-   **Office set:** RO CHANDIGARH (RO variant) or employee's DO (DO
    variant)

### Stage 2 --- Send to assistant (admin clearance)

-   **Trigger:** Last Reviewed = ABHIMANYU SWAMI + next = AMIT (Pending
    Review, N/A)
-   **Action:** Add Reviewer → correct assistant (cadre/office routing)
-   **Remark:**
    `Kindly review for admin. clearance and check for the details.`
-   **Office set:** RO CHANDIGARH

### Stage 3 --- Fill approval remark (final approval)

-   **Trigger:** Last assistant reviewed + remark contains key sentence
    (NOT negated) + BALJIT status = clear + next = AMIT (Pending Review,
    N/A)
-   **Action:** Fill Reviewer Remarks in-place (no navigation). Officer
    submits manually.
-   **Key sentence:**
    `the said request has been found to be in order and in accordance with the applicable policies, circulars, and advisories presently in`
-   **Negative-safe check:** 25-char look-behind for "not" before key
    phrase
-   **Remark (non-RO):** Full approval text referencing DO + RO
    clearances
-   **Remark (RO CHANDIGARH):** Full approval text referencing RO-only
    clearance

### Stage 3B --- Send back to DO (assistant found issue)

-   **Trigger:** Last assistant reviewed + remark NOT "in order" + next
    = AMIT (Pending Review, N/A) + office ≠ RO CHANDIGARH + not a
    mismatch case
-   **DO Manager identification:** Entry immediately before the AGM
    entry (Designation = "Assistant General Manager") that has a
    non-empty, non-N/A remark
-   **Action:** Add Reviewer → DO Manager (name-based selection)
-   **Remark:**
    `Reference may be made to the observations recorded during examination of the request at Sl. No. [X]. Required necessary clarifications and/or supporting documents, as indicated, may kindly be furnished for further processing.`
    (where \[X\] = assistant's S.No.)
-   **Office set:** Employee's DO (from page)

### Stage 3C --- Re-send to assistant after DO reprocesses

-   **Trigger:** Last entry before AMIT (Pending Review, N/A) = same DO
    Manager identified by AGM landmark
-   **Action:** Add Reviewer → correct assistant (cadre/office routing)
-   **Remark:** Same as Stage 2
-   **Office set:** RO CHANDIGARH

### Stage 3D --- Send back to initiating official (RO CHANDIGARH, assistant found issue)

-   **Trigger:** Same as Stage 3B but office = RO CHANDIGARH
-   **Action:** Add Reviewer → initiating employee (S.No. 1 entry)
-   **Remark:** Same format as Stage 3B (citing assistant's S.No.)
-   **Office set:** RO CHANDIGARH

### Stage 3E --- Fill rejection proposal remark (vigilance case pending)

-   **Trigger:** Last assistant reviewed + remark NOT "in order" +
    BALJIT status = notclear + next = AMIT (Pending Review, N/A)
-   **Action:** Fill Reviewer Remarks in-place. Officer submits
    manually.
-   **Fields read from page:** Employee Name (`employee_name`),
    Designation (`designation`), Cadre (`cadre`), Examination Name
    (`examination_name`), NOC count (`nNOCApproved` + 1)
-   **Remark:** Proposal for rejection citing FCI HQ Circular
    No. 01-2019-05 dated 17.01.2019 and DoPT O.M. dated 23.12.2013

### Mismatch Cases --- BALJIT and Assistant disagree

  ---------------------------------------------------------------------------------
  Case                    Condition                         Action
  ----------------------- --------------------------------- -----------------------
  MismatchNotClear        BALJIT clear + Assistant mentions Add Reviewer → same
                          vigilance contradiction           assistant with
                          (`VIGILANCE_MISMATCH_PATTERNS`)   correction remark

  MismatchClear           BALJIT notclear + Assistant says  Highlight rows, no
                          "in order"                        action --- manual
                                                            review required

  MismatchAmbiguous       BALJIT present but ambiguous      Highlight rows, no
                                                            action --- manual
                                                            review required
  ---------------------------------------------------------------------------------

**Floating panel display (v5.0):** MismatchClear and MismatchAmbiguous
both set `hasRecommendation: false` / `recommendedSummary: null` ---
they are **folded into the same "No recommendation detected" panel
state** as a true no-match, by deliberate design decision. There is no
distinct third panel state for "conflict detected." Row highlighting on
the page itself (`highlightMismatch()` --- BALJIT's row in red, the
assistant's row in orange) is unaffected and still fires; only the
panel's text is folded. MismatchNotClear is unaffected --- it still has
a real recommendation and displays normally.

**`VIGILANCE_MISMATCH_PATTERNS`** (aligned with Stage 3E vocabulary):
`/pending/i`, `/under\s+contemplation/i`, `/not\s+free/i`,
`/not\s+vigilance\s+(clear|free)/i`, `/vigilance\s+case/i`,
`/disciplinary\s+proceedings/i`, `/charge\s*-?\s*sheet/i`,
`/not\s+clear/i`, `/involved/i`

------------------------------------------------------------------------

## Critical Technical Patterns

### Office Name Whitespace Normalisation

The portal stores office names with double spaces in both `<option>`
tags and action history cells (e.g. `"DO  BHATINDA"`). Always normalise
before comparing:

``` javascript
value.trim().replace(/\s+/g, ' ').toUpperCase()
```

### Stage 3 Key Sentence --- Negative-Safe Check

``` javascript
const idx = remark.toLowerCase().indexOf(STAGE3_KEY_SENTENCE);
if (idx === -1) return false;
const preceding = remark.substring(Math.max(0, idx - 25), idx);
return !(/\bnot\b/.test(preceding));
```

### Pagination --- Read All Pages Before Stage Detection

`content.js` collects entries from ALL pages of the action history table
sequentially (page 1 → 2 → 3...) before calling
`checkConditionsAndAct()`. Stage detection always operates on the
complete entries array, never just the visible page.

### Select2 Dropdown Interaction

All dropdowns use Select2. Must use script-tag injection (not
`window.jQuery`) to trigger Select2 in `world: "MAIN"`:

``` javascript
function triggerSelect2(selectId, value) {
  const script = document.createElement('script');
  script.textContent = '(function() { var el = document.getElementById("' + selectId + '"); if (el && typeof $ !== "undefined") { $(el).val("' + value + '").trigger("change"); } })();';
  document.head.appendChild(script);
  script.remove();
}
```

### Select2 Dropdown Matching --- Exact-Match-First (v5.0)

`waitForDropdownAndSelectByText()` in `content_add_reviewer.js` matches
in two phases to avoid substring collisions (e.g. searching for "AMIT
KUMAR" incorrectly matching an option "AMIT KUMAR VERMA" that happens
to appear earlier in the list than the intended "AMIT KUMAR SINGH"):

``` javascript
const targetNorm = matchValue.toString().trim().replace(/[\s\xa0]+/g, ' ').toUpperCase();

// Phase 1: exact match (normalized, including NBSP)
for (let opt of options) {
  const optText = opt.textContent.trim().replace(/[\s\xa0]+/g, ' ').toUpperCase();
  if (optText === targetNorm) { matchedValue = opt.value; break; }
}

// Phase 2: substring match (fallback only, for deliberately partial matchValues)
if (matchedValue === null) {
  for (let opt of options) { /* .includes() as before */ }
}
```

Phase 1 handles the common case (full name / full office string passed
as `matchValue`). Phase 2 remains as a fallback for genuinely partial
values (e.g. an employee number that's a substring of a longer
"12345 -- NAME" option).

### Safety Features (must be present in every version)

1.  **NOE prefix guard** --- at entry point of all three scripts
2.  **`fci_noc_triggered` flag** --- Add Reviewer script returns if not
    `"yes"`; cleared immediately after reading
3.  **No auto-submission** --- extension never clicks Add / OK / Submit
4.  **No match = no action** --- if no stage conditions match, extension
    does nothing
5.  **Highlight before acting** --- trigger row flashes yellow before
    navigation
6.  **Panel actions never auto-submit either** --- Re-examine / Return
    to Previous Level only fill the form (or re-fill it in place); the
    officer still submits manually

------------------------------------------------------------------------

## Known Pending Items

-   **Stage 1B** --- code complete but not yet tested on a live RO
    CHANDIGARH request dispatched by MAYURESH KUMAR. Verify on first
    occurrence.
-   **Stage 3C** --- designed and coded but not yet tested on a live
    request where the DO Manager has reprocessed and sent back. Verify
    on first occurrence.
-   **Stage 3D** --- coded but not yet tested on a live request. Verify
    on first occurrence.
-   **Stage 1D** --- coded but not yet tested. Verify on first
    occurrence.
-   The RO CHANDIGARH Stage 3 remark has two intentional double-spaces
    ("vigilance and", "at Regional"). Do NOT correct these.
-   **Floating Window Framework (v5.0)** --- code complete, audited
    across several rounds, not yet exercised on a live request end to
    end. Verify on first live occurrence: panel renders correctly on
    both pages, Re-examine / Return to Previous Level produce the
    correct target, and the in-place re-fill on the Add Reviewer page
    works after the automatic fill has already run.
-   A crash was found and fixed during audit where the Stage 3 branch
    called a `precomputeAllPayloads()` function that no longer existed
    in the file (leftover from an earlier refactor) --- this would have
    silently broken the approval remark auto-fill. Confirmed fixed; no
    other undefined-function references found on a full pass.

------------------------------------------------------------------------

## Version History

  -------------------------------------------------------------------------------
  Version                 Date                    Key Changes
  ----------------------- ----------------------- -------------------------------
  v1                      May 2026                Initial: Stages 1, 1B, 2

  v2                      May 2026                Added Stage 3; NOE prefix
                                                  safety guard on all scripts

  v3                      May 2026                Fixed double-space bug in
                                                  office name matching in
                                                  `content.js`

  v4                      May 2026                Added Stages 3B, 3C;
                                                  negative-safe Stage 3 key
                                                  sentence check; fixed
                                                  double-space bug in
                                                  `content_add_reviewer.js`

  v4.1                    May 2026                Added Stage 3E (vigilance case
                                                  rejection proposal);
                                                  `nNOCApproved` field confirmed

  v4.2                    May 2026                Added BALJIT pole point;
                                                  mismatch detection; Stage 3D;
                                                  Stage 1C; Stage 1D

  v4.3                    May 2026                Fixed `mismatchClear` --- added
                                                  `!isPostPerformaFlag`;
                                                  separated `baljitMissing` from
                                                  `baljitAmbiguous`

  v4.4                    May 2026                Pagination fix --- collect all
                                                  pages before stage detection;
                                                  manifest non-www domains added;
                                                  `content_add_reviewer.js`
                                                  regression fixed

  v4.5                    Jun 2026                `content.js` as single source
                                                  of truth --- explicit
                                                  sessionStorage for all stages;
                                                  `content_add_reviewer.js` fully
                                                  data-driven (no stage flags);
                                                  single `selectEmployee()`
                                                  function with empNo-primary +
                                                  name-fallback;
                                                  `VIGILANCE_MISMATCH_PATTERNS`
                                                  aligned with Stage 3E
                                                  vocabulary; `goToLastPage()`
                                                  restored in Add Reviewer

  v5.0                    Aug 2026                Floating Window Framework
                                                  migration --- `window.FCIWorkflow`
                                                  bridge added to both `content.js`
                                                  and `content_add_reviewer.js`;
                                                  `fp.*` sessionStorage namespace
                                                  added alongside legacy
                                                  `fci_noc_*` keys (compatibility
                                                  adapter, both written); three
                                                  action payloads (recommended /
                                                  reexamine / returnprevious)
                                                  precomputed once per page load;
                                                  `getDoManagerEntry()` extracted
                                                  as a single standalone helper
                                                  (previously duplicated inline in
                                                  three places during an earlier
                                                  draft, now centralised);
                                                  MismatchClear / MismatchAmbiguous
                                                  folded into the "No
                                                  recommendation" panel state by
                                                  design, not shown as a distinct
                                                  third state; exact-match-first +
                                                  NBSP-aware normalisation added to
                                                  `waitForDropdownAndSelectByText()`
                                                  in `content_add_reviewer.js`;
                                                  live in-place payload re-fill
                                                  (`switchPayload()`) added so the
                                                  officer can override the
                                                  recommendation after landing on
                                                  Add Reviewer; fixed a crash where
                                                  the Stage 3 branch called an
                                                  undefined `precomputeAllPayloads()`
                                                  left over from an earlier draft
  -------------------------------------------------------------------------------

------------------------------------------------------------------------

## Important Notes

-   This repository is **private**. Do not make it public --- it
    contains internal workflow logic and employee reference data.
-   Extensions **never auto-submit**. The final Add / OK / Submit button
    is always clicked manually by the officer.
-   `content.js` is the **single source of truth** for all routing
    decisions. `content_add_reviewer.js` contains zero business logic.
-   Every change to routing logic must be made in `content.js` only.
-   After every file change, reload the extension at
    `chrome://extensions/` before testing.

# FCI NOC Assistant -- Investigation Log (July 2026)

## Purpose

This section records verified observations made during troubleshooting
of the Add Reviewer automation. It intentionally distinguishes verified
facts from hypotheses. No architectural conclusions should be drawn
unless independently reproduced.

## 1. XHR Monitoring

-   The browser Network tab (XHR filter) was monitored while manually
    changing the **Office Type** field.
-   No XHR request was observed immediately after changing Office Type.
-   This only confirms what was observed during testing; it does **not**
    establish how the Office → Employee cascade is implemented.

**Status:** Verified observation.

## 2. Office Dropdown Exists in the DOM

Command executed:

``` javascript
document.querySelector("#filter_office")
```

Result: the `<select id="filter_office">` element existed.

**Status:** Verified.

## 3. jQuery Availability

Commands executed:

``` javascript
typeof window.jQuery
window.jQuery("#filter_office").length
```

Results:

-   `typeof window.jQuery` → `"function"`
-   `window.jQuery("#filter_office").length` → `1`

Therefore the page exposes jQuery after it has fully loaded and the
Office dropdown is accessible through jQuery.

**Status:** Verified.

## 4. Office-Type Event Bindings

Command executed:

``` javascript
window.jQuery._data(document.querySelector("#filter_office_type"), "events")
```

Observed events:

-   change
-   focus
-   select2:select
-   select2:unselect

The investigation did **not** determine which event actually initiates
the Office → Employee cascade.

**Status:** Verified.

## 5. Diagnostic waitForJQuery() Logging

A temporary diagnostic version of `waitForJQuery()` logged:

-   attempt number
-   `typeof window.jQuery`
-   `typeof window.$`
-   `typeof window.jQuery.fn.select2`

One execution reported all values as unavailable for every attempt.

After reloading the extension, a later execution detected jQuery and
Select2 immediately and the automation completed successfully.

This establishes only that different executions produced different
runtime observations. It does **not** establish the reason.

**Status:** Verified observations only.

## 6. CSP Observation

During one failing execution Chrome reported a Content Security Policy
warning relating to inline script execution.

After reloading the extension the warning was no longer observed and the
automation worked normally.

No causal relationship was established.

**Status:** Observation only.

## 7. Manual Verification

The following manual checks were completed successfully:

-   `typeof window.jQuery`
-   `window.jQuery("#filter_office").length`
-   `window.jQuery._data(...)`
-   Manual Office Type selection
-   Office dropdown population after manual selection

These confirmed that the HRMS page exposes jQuery and Select2 correctly
once fully initialized.

**Status:** Verified.

## 8. Final Successful Run

Following an extension reload:

-   jQuery detected.
-   Select2 detected.
-   Office Type selected.
-   Office selected.
-   Employee selected.
-   Remark populated.
-   Form completed successfully.

No business logic changes were required for this successful execution.

**Status:** Verified.

## Conclusions

The investigation did **not** conclusively identify the original root
cause.

The following were **not established**:

-   Why one execution could not access jQuery while a later execution
    could.
-   Whether CSP contributed to the original failure.
-   Whether the issue originated from extension loading, caching,
    timing, or another environmental factor.

Future modifications should therefore be based on reproducible evidence
rather than assumptions.
