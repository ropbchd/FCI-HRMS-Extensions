# Floating Window Framework — Design Specification, Onboarding Guide & Master Prompt
**FCI HRMS Browser Extensions — Consolidated Architecture v2**

---

## Part 0 — Read This First (Bootstrapping / Compatibility Check)

This section exists so that this document can be pasted into a brand-new conversation and immediately begin useful work, instead of the new conversation having to rediscover the framework's assumptions from scratch. **Read this part before reading anything else in the document.**

### The Framework Contract, in Four Lines

1. `content.js` remains the single source of truth for all business logic. It never loses its existing stage-detection or routing behaviour.
2. `content.js` exposes a single global bridge object, `window.FCIWorkflow`, with methods the floating window calls directly.
3. `floating_window.js` knows nothing about any workflow. It only calls `window.FCIWorkflow` methods and renders whatever they return.
4. `content_add_reviewer.js` stays purely mechanical — reads sessionStorage, fills the form. It never contains routing logic, for any workflow, ever.

### Required API Surface

Every workflow's `content.js` must expose:

```javascript
window.FCIWorkflow = {
  getWorkflowContext(),   // returns { requestId, hasRecommendation, recommendedSummary, ... }
  executeReExamine(),     // triggers the Re-examine routing path
  executeReturnPrevious() // triggers the Return-to-Previous-Level routing path
}
```

**Note:** there is no `executeRecommended()`. The recommended path is `content.js`'s existing default automatic behaviour, unchanged by this framework. The panel only ever *displays* it; it never triggers it.

### Precomputation Requirement

Because the panel must work correctly whether the user acts on the Review page or on the Add Reviewer page (see Part 6), `content.js` must compute all three possible routing payloads — recommended, re-examine, return-previous — before it ever navigates away from the Review page, and hand all three to sessionStorage, not just the winning one. `content_add_reviewer.js` picks between three already-computed payloads; it never computes a routing decision itself.

### No-Recommendation State

If stage detection finds no match, `getWorkflowContext()` returns `hasRecommendation: false`. The panel greys out the recommended-action display and shows "No recommendation detected" — but **Re-examine and Return-to-Previous stay active regardless**, since neither depends on stage-matching succeeding. This is the manual escape hatch for whenever the extension is otherwise stuck.

### Step 1 — Before Any Design or Code Discussion

If you are starting a new conversation with this document to build or extend a workflow extension, establish this first:

**Do you already have a `content.js` for this workflow?**

- **If yes** — paste it now. It will be checked against two separate things:
  - **Data check:** does it already *compute* the values a panel needs (request ID, recommended-action summary, cadre/office, DO vs RO origin, the "relevant assistant" for the current cadre/office)? Most existing workflows likely compute most of this already, as a side effect of normal stage detection.
  - **API check:** does it already *expose* those computations as the `window.FCIWorkflow` bridge described above? For every extension built before this framework existed, the answer is no — this is new surface area, not something that was ever missing before.

  Any gaps are closed with a **thin adapter layer only** — new code that reads values `content.js` already computes and exposes them through the required bridge shape. Existing stage-detection and routing code is never rewritten to accommodate this.

- **If no** — the workflow-specific `content.js` is designed first, business rules and all, exactly as has been done for every extension so far. The `window.FCIWorkflow` bridge is the last piece added, once the routing logic itself is proven and stable.

### Step 2 — Compatibility Guard (Diagnostic, Not Defensive)

`floating_window.js` checks for each required bridge method before calling it. If missing, it logs a specific console message (e.g. `"executeReExamine() not found — this page's content.js hasn't implemented the floating window bridge yet."`) rather than failing silently. Outward behaviour is identical either way — nothing happens — but the console carries the exact breadcrumb needed to troubleshoot without re-deriving the cause from scratch.

---

## Part 1 — Purpose & Design Philosophy

### Purpose

The floating window is a **supplementary control layer** for FCI HRMS browser extensions. It does not replace existing `content.js` workflow logic. It provides optional manual actions that can be invoked when needed, while the normal automation continues to run exactly as it already does.

### Design Philosophy

- Existing `content.js` remains the single source of truth.
- Existing stage detection remains unchanged.
- Existing routing logic remains unchanged.
- The floating window only exposes additional actions.
- All business logic — assistants, offices, managers, remarks, routing rules — stays inside `content.js`.
- The floating window calls the bridge; `content.js` executes.

### Why This Architecture

- One place holds business logic — always `content.js`, never the panel.
- The floating window is reusable, unmodified, across Passport, Other Exam, Audit Leave, and every future workflow.
- Minimal changes to existing, already-proven extensions.
- Debugging stays simple: a routing bug is always a `content.js` bug, never "is it the panel or the workflow script."
- Consistent user experience across every request type.

### Proposed Buttons

1. **Recommended Action** — display only. Shows the action `content.js` has already inferred (and, for most workflows, already executed automatically). Never clickable.
2. **Re-examine** — sends the request back to the relevant assistant with a generic remark.
3. **Return to Previous Level** — if initiated at a Divisional Office, returns to the Manager (Admin.); if initiated at a Regional Office, returns to the initiating official. **Confirmed as a universal rule across all workflows** (Passport, Other Exam, Audit Leave, Gratuity, Benevolent Fund).

Both alternative buttons are **always shown, regardless of which stage matched** — including when the recommended action already happens to be a return-type or re-send-type action. This is a deliberate simplification: the alternatives are independent, always-available manual overrides, not conditional on what the recommended path already does.

---

## Part 2 — Separation of Responsibilities & Communication Model

### content.js

Responsible for:
- Reading the request and parsing the action history.
- Detecting the business stage.
- Determining routing (recommended, and — see Part 3 — the two universal alternatives).
- Preparing and executing routing data.
- Exposing the `window.FCIWorkflow` bridge.

### floating_window.js

Responsible only for:
- Creating the floating panel.
- Displaying workflow status and the recommended-action summary.
- Showing the two alternative-action buttons.
- Calling `window.FCIWorkflow` methods directly.
- Never containing workflow-specific data or routing logic of any kind.

### content_add_reviewer.js

No architectural changes from its current, proven behaviour. It continues to:
- Read sessionStorage.
- Fill Office, Employee, and Reviewer Remarks.
- Never decide routing — it only ever picks between payloads `content.js` already computed.

### Communication Model

```
   User
    │
    ▼
Floating Window  ──(direct call)──►  window.FCIWorkflow (exposed by content.js)
                                              │
                                    (uses existing routing logic)
                                              │
                                              ▼
                                     Add Reviewer page
                                              │
                                              ▼
                                content_add_reviewer.js
```

**Transport rule (firm, not a menu of options):**

- **Floating window → content.js** (same page, same moment): direct method calls on `window.FCIWorkflow`. No events, no serialization, no command strings to switch on — both scripts share the same page and the same JS scope, so the bridge object is simply handed function references.
- **content.js → content_add_reviewer.js** (different page, different page load): sessionStorage, exactly as already implemented today. This is the only place sessionStorage is used as a routing-data carrier.

---

## Part 2A — Consolidated Lifecycle

The information in this section already exists scattered across Parts 2 and 6. It is repeated here once, end to end, purely as a single onboarding-friendly walkthrough — it introduces no new rule.

```
Extension starts
        │
        ▼
content.js loads on the Review page
        │
        ▼
Request detected, "View Action History" triggers a table load
        │
        ▼
content.js waits for the table to populate, then parses it
        │
        ▼
content.js determines: recommended routing, re-examine routing,
and return-previous routing — all three, per Part 6
        │
        ▼
content.js caches this state (Part 3) and exposes window.FCIWorkflow
        │
        ▼
Floating panel is injected (only now — never before parsing is done)
        │
        ├── User does nothing ──► content.js's existing automatic
        │                          (recommended) behaviour proceeds
        │                          unchanged
        │
        └── User clicks Re-examine or Return to Previous
                    │
                    ▼
        floating_window.js calls the corresponding
        window.FCIWorkflow method directly
                    │
                    ▼
        content.js executes that routing, writes all three
        precomputed payloads to sessionStorage, navigates
                    │
                    ▼
        Add Reviewer page opens, panel persists here too
                    │
                    ├── User leaves the recommended/already-chosen
                    │    payload as-is
                    │
                    └── User overrides here instead, panel tells
                         content_add_reviewer.js which of the three
                         precomputed payloads to use
                    │
                    ▼
        content_add_reviewer.js fills Office / Employee / Remark
        from the chosen payload — purely mechanical, no routing logic
                    │
                    ▼
        User reviews the filled form and clicks "Add" manually
        (this step never happens automatically, for any payload)
```

**The one principle this diagram exists to reinforce:** at no point in this sequence does the floating panel analyse the workflow, parse a table, or decide a routing outcome. It only displays what `content.js` has already decided, and relays which of the already-decided outcomes the user picked.

---

## Part 3 — content.js Compatibility Contract

### Required Bridge Object

```javascript
window.FCIWorkflow = {
  getWorkflowContext() {
    return {
      requestId: _fciWorkflowCache.requestId,
      hasRecommendation: _fciWorkflowCache.hasRecommendation,
      recommendedSummary: _fciWorkflowCache.recommendedSummary
    };
  },
  executeReExamine() { /* Part 5 */ },
  executeReturnPrevious() { /* Part 5 */ }
};
```

### State Caching Pattern (Module-Level Variable)

Rather than having `executeReExamine()` / `executeReturnPrevious()` re-parse the action history table on click, the values `content.js` already computes during its normal automatic run are cached once, at the point they're first computed, in a plain module-level variable. Both bridge methods then read from this variable directly — no re-lookup, no waiting, no re-triggering any parsing.

**1. Declare the cache once, near the top of `content.js`:**

```javascript
// === Floating Window Bridge — cached workflow state ===
let _fciWorkflowCache = {
  requestId: null,
  entries: null,
  cadreValue: null,
  officeValue: null,
  isRoChandigarh: null,
  hasRecommendation: false,
  recommendedSummary: null
};
```

**2. Populate it wherever stage detection already computes these values** (e.g. at the top of the function that reads action history and decides the stage — `checkConditionsAndAct()` in existing scripts):

```javascript
_fciWorkflowCache.entries        = entries;
_fciWorkflowCache.cadreValue     = cadreValue;
_fciWorkflowCache.officeValue    = officeValue;
_fciWorkflowCache.isRoChandigarh = isRoChandigarh;
_fciWorkflowCache.requestId      = getRequestId();
```

**3. One line per matched stage, at the point that stage takes its action**, recording what was recommended:

```javascript
_fciWorkflowCache.hasRecommendation  = true;
_fciWorkflowCache.recommendedSummary = 'Stage 2 — routing to ' + assistant.name + ' for admin. clearance';
```

If no stage matches, `hasRecommendation` simply stays `false` from the initial declaration — nothing extra needs to be written for the no-match case, consistent with the existing "no-match = no-action" safety rule.

**Scope note:** this document deliberately does not enumerate the exact insertion point for every stage branch of any specific extension's `content.js` — doing so would tie a general-purpose architecture document to one file's particular stage count and structure. The pattern above is what every workflow's `content.js` follows; wiring the one-line cache update into each of that workflow's own stage branches is done individually while building or retrofitting that specific file.

---

## Part 3A — content.js Data Checklist (Mandatory / Optional)

Part 3 defines the *methods* a compatible `content.js` must expose. This part defines the *values* it must be able to determine before those methods can return anything meaningful — an enumerated checklist, reconciled to the settled design (no separate Manager vs. Previous-Level fields, since those are the same routing slot resolved two different ways depending on DO/RO origin; no separate "Recommended Remark" field, since the recommended path is display-only and never assembled into a routing payload by the bridge).

### Mandatory

**Request Information**
- Request Type
- Request ID
- Current Workflow Stage (internal only — never surfaced to the panel UI, per Part 4's wording rules)

**Employee Information**
- Employee Name
- Cadre
- Office of Posting

**Request Origin**
- Whether the request originated from a Regional Office or a Divisional Office (`isRoChandigarh` or equivalent) — this single value is what Part 5's Return-to-Previous logic branches on.

**Recommended Action (display only)**
- `hasRecommendation` (boolean)
- `recommendedSummary` (business-language string, no stage numbers)

**Re-examine Routing** *(computed on demand inside `executeReExamine()`, not necessarily cached ahead of time — see Part 3)*
- Resolved Assistant Name
- Resolved Assistant Employee Number

**Return to Previous Level Routing** *(computed on demand inside `executeReturnPrevious()`)*
- Resolved Target Name (either the DO Manager (Admin.) or the RO initiating official, depending on origin)
- Resolved Target Office

### Optional (stored only when relevant to the specific request type)

- Designation
- Passport Application Type
- Examination Type
- Leave Category / Block Year
- Annexure requirement flags
- Vigilance or administrative clearance status
- Any other request-specific metadata a given workflow needs for its own remark construction

### Design Principle

The floating panel never attempts to determine any of the above by itself, mandatory or optional. Its only responsibility is to consume what `content.js` has already made available through the bridge (Part 3) or, for the cross-page case, through sessionStorage (Part 6A).

---

## Part 4 — Floating Panel UI Specification

### Layout

```
--------------------------------------------------
 FCI Workflow Assistant

 Request
 NOCPASS12345

 Recommended Action
 [ Stage 2 — routing to MADHU DHAKA for admin. clearance ]   (display only, never a button)

 Alternative Actions
 [ Re-examine ]
 [ Return to Previous Level ]

 Status
 Ready
--------------------------------------------------
```

### Wording Rules

The interface speaks only in business language. It never exposes:
- Stage numbers
- Internal variable names
- sessionStorage keys
- Assistant employee numbers
- Routing rules or logic

### States

| Condition | Recommended Action display | Re-examine | Return to Previous |
|---|---|---|---|
| Stage matched normally | Shows the recommended-action summary | Active | Active |
| No stage matched (`hasRecommendation: false`) | Greyed out, reads "No recommendation detected" | **Active** | **Active** |

The no-recommendation state is deliberately minimal: the panel doesn't attempt to explain *why* nothing matched, or offer diagnostics. If the extension is stuck, both manual alternatives remain available as the way forward — troubleshooting starts from there, not from the panel itself.

### Explicitly Decided Against (for reference, so these aren't re-litigated)

- **No disabled/loading state tied to async readiness.** The panel is only injected after `content.js` has already finished parsing the action history table (per the existing, already-correct sequencing: click View Action History → wait for table → parse → *then* show panel). There is no window where the panel exists but the bridge isn't ready, so no loading state is needed.
- **No confirmation dialog before Re-examine or Return to Previous.** The HRMS Add Reviewer page itself never auto-submits — the user always presses "Add" manually. That existing checkpoint is the real backstop; a second confirmation inside the panel would be redundant friction on paths that are already one click away from a human-reviewed, human-submitted form.

---

## Part 5 — Floating Panel API & Bridge Implementation

### Re-examine — resolves the "relevant assistant" via cadre/office lookup

This reuses whatever cadre/office → assistant lookup a workflow already implements for its normal assistant-routing stage (e.g. Stage 2 in the Other Exam NOC workflow), since that logic is inherently stage-independent — it only needs current cadre and office, not which stage matched.

```javascript
executeReExamine() {
  const { cadreValue, officeValue } = { cadreValue: _fciWorkflowCache.cadreValue, officeValue: _fciWorkflowCache.officeValue };
  const assistant = decideAssistant(cadreValue, officeValue); // existing per-workflow lookup

  if (!assistant) {
    console.warn('[FCI Workflow Assistant] Re-examine: could not resolve assistant for Cadre="'
      + cadreValue + '", Office="' + officeValue + '". No action taken.');
    return; // no-match = no-action, same rule as everywhere else in the codebase
  }

  sessionStorage.setItem('fci_stage',              'reexamine');
  sessionStorage.setItem('fci_office_type',        OFFICE_TYPE_RO);
  sessionStorage.setItem('fci_target_office',      RO_CHANDIGARH);
  sessionStorage.setItem('fci_assistant_emp',      assistant.empNo);
  sessionStorage.setItem('fci_assistant_name',     assistant.name);
  sessionStorage.setItem('fci_assistant_remark',
    'Kindly re-examine the request in light of the applicable rules and circulars of the Corporation.');
  sessionStorage.removeItem('fci_target_employee_name');
  clickAddReviewer();
}
```

### Return to Previous Level — resolves DO Manager or Initiating Official

```javascript
executeReturnPrevious() {
  const isRoChandigarh = _fciWorkflowCache.isRoChandigarh;
  const officeValue    = _fciWorkflowCache.officeValue;
  const entries         = _fciWorkflowCache.entries;

  let targetName, officeType, targetOffice;

  if (isRoChandigarh) {
    const initiatingEmployee = getInitiatingEmployee(entries); // existing helper
    if (!initiatingEmployee) {
      console.warn('[FCI Workflow Assistant] Return to Previous: could not identify initiating official. No action taken.');
      return;
    }
    targetName   = initiatingEmployee.name;
    officeType   = OFFICE_TYPE_RO;
    targetOffice = RO_CHANDIGARH;
  } else {
    let agmIndex = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].designation.trim() === AGM_DESIGNATION
          && entries[i].remark.trim() !== 'N/A'
          && entries[i].remark.trim() !== '') {
        agmIndex = i;
        break;
      }
    }
    const doManagerEntry = agmIndex > 0 ? entries[agmIndex - 1] : null;
    if (!doManagerEntry) {
      console.warn('[FCI Workflow Assistant] Return to Previous: could not identify DO Manager. No action taken.');
      return;
    }
    targetName   = doManagerEntry.employeeName;
    officeType   = OFFICE_TYPE_DO;
    targetOffice = officeValue.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  sessionStorage.setItem('fci_stage',                'returnprevious');
  sessionStorage.setItem('fci_office_type',          officeType);
  sessionStorage.setItem('fci_target_office',        targetOffice);
  sessionStorage.setItem('fci_target_employee_name', targetName);
  sessionStorage.setItem('fci_assistant_remark',
    'The observations recorded in the action history may kindly be perused, and the requisite clarification, confirmation, or documentation furnished for further processing of the request.');
  sessionStorage.removeItem('fci_assistant_emp');
  sessionStorage.removeItem('fci_assistant_name');
  clickAddReviewer();
}
```

### Universal Remark Text (Reference)

| Action | Remark |
|---|---|
| Re-examine | "Kindly re-examine the request in light of the applicable rules and circulars of the Corporation." |
| Return to Previous Level | "The observations recorded in the action history may kindly be perused, and the requisite clarification, confirmation, or documentation furnished for further processing of the request." |

Both are deliberately generic — they do not reference a specific Sl. No. or a specific stage's observations, because these are manual override paths that can be triggered independent of which stage matched, and must read correctly regardless of context.

### Compatibility Guard in floating_window.js

```javascript
if (!window.FCIWorkflow || typeof window.FCIWorkflow.executeReExamine !== 'function') {
  console.warn('[Floating Window] executeReExamine() not found — this page\'s content.js hasn\'t implemented the floating window bridge yet.');
} else {
  window.FCIWorkflow.executeReExamine();
}
```

Same pattern applies to `executeReturnPrevious()` and `getWorkflowContext()`. Outward behaviour on a missing method is identical to the no-match case — nothing happens — but the console carries the exact diagnostic.

---

## Part 6 — Panel Persistence & the Precomputed-Payload Requirement

### Why the panel exists on both pages

The floating panel is present on **both** the Review page and the Add Reviewer page, not just the Review page. This resolves what would otherwise be a race condition:

- **On the Review page:** if the user clicks an alternative before `content.js`'s automatic recommended-path navigation happens, the alternative's data is used instead — no navigation has occurred yet.
- **If `content.js` has already auto-navigated to the Add Reviewer page** with the recommended routing pre-filled (today's existing behaviour for many stages): the panel, present there too, lets the user overwrite the already-filled Office/Employee/Remark fields with the Re-examine or Return-to-Previous payload instead — before the "Add" button is ever pressed.

Either way, the Add Reviewer page's existing "never auto-submits" behaviour is the real backstop. The panel doesn't need to catch the user "in time" on the Review page — it just needs the override to still be possible up until the moment "Add" is clicked.

### Implication: content.js precomputes all three payloads

For the Add Reviewer-page override (second bullet above) to work without introducing routing logic into `content_add_reviewer.js`, `content.js` must compute **recommended, re-examine, and return-previous** payloads together, before navigating away from the Review page, and store all three in sessionStorage — not just the winning one. The floating panel on the Add Reviewer page then does nothing but pick which of the three precomputed payloads `content_add_reviewer.js` should use to fill the form. It never computes a routing decision itself, on either page.

This keeps `content.js` as the sole source of truth for all business logic, on both pages, at the cost of computing three answers instead of one before every navigation.

---

## Part 6A — Standard sessionStorage Namespace & Compatibility Adapter

### Scope of this part — read this first

This namespace applies **only** to the Review-page → Add-Reviewer-page sessionStorage handoff described in Part 2's transport rule and Part 6's precomputed-payload requirement. It has no bearing on same-page panel-to-`content.js` communication, which uses direct `window.FCIWorkflow` method calls and never touches sessionStorage at all.

### The problem this solves

Without a shared convention, every extension invents its own storage key prefix — `fci_noc_assistant_name`, `ala_target_name`, `bf_assistant_name`, and so on. This makes `content_add_reviewer.js` harder to keep genuinely generic, since a truly workflow-blind form-filler benefits from reading a fixed, predictable set of key names rather than needing to know which prefix a given workflow happens to use.

### Suggested Namespace

```
fp.request.type
fp.request.id
fp.stage

fp.employee.name
fp.employee.office

fp.route.recommended.name
fp.route.recommended.office

fp.route.reexamine.name
fp.route.reexamine.emp
fp.route.reexamine.office

fp.route.returnprevious.name
fp.route.returnprevious.office

fp.remark.reexamine
fp.remark.returnprevious

fp.chosen        ← which of the three payloads content_add_reviewer.js should use
                    ("recommended" | "reexamine" | "returnprevious")
```

`fp.chosen` is the one key that didn't exist in the original per-workflow schemes — it's what lets the Add Reviewer-page panel (Part 6) tell `content_add_reviewer.js` which precomputed payload to apply, without `content_add_reviewer.js` ever needing to know why.

### Compatibility Layer — no forced migration

Existing extensions are not required to rename their current sessionStorage keys immediately. Wherever an extension already stores equivalent information under its own prefix (e.g. `fci_noc_assistant_name`), a small adapter — a handful of lines at the point routing data is written — maps the existing keys to the standard namespace alongside the originals:

```javascript
// Compatibility adapter — existing key stays authoritative, standard key added alongside it
sessionStorage.setItem('fp.route.reexamine.name', sessionStorage.getItem('fci_noc_assistant_name'));
```

This keeps every already-deployed extension working exactly as it does today, while giving `content_add_reviewer.js` (and any future generic tooling) one predictable namespace to read from going forward. New extensions, per Part 8's Integration Guide, write directly to the standard namespace from the start and never need the adapter.

---

## Part 7 — Worked Example: Other Exam NOC content.js

This part exists because the Other Exam NOC workflow's `content.js` is the most structurally complex extension built so far (roughly a dozen distinct stages, including RO/DO variants and mismatch-handling branches). If the framework's pattern holds cleanly against this file, it holds for every simpler workflow.

### Finding: some "recommended" stages are already return/resend types

Stages 3B and 3D of this workflow already send the request back to the DO Manager or initiating official as their *recommended* action — i.e., functionally identical to what the panel calls "Return to Previous Level." Stage 3C and the `mismatchNotClear` case already send the request back to an assistant for re-examination as their *recommended* action — functionally identical to "Re-examine."

**Resolved design decision:** both alternative buttons are shown regardless — even when the recommended action already is a return-type or re-send-type action for that particular stage. The alternatives are treated as independent, always-available manual overrides, not conditional on what the matched stage's recommended action happens to be. (This is Option 2 from the design discussion, chosen for simplicity over conditionally suppressing a button that would sometimes duplicate the recommended action.)

### Reused logic for the two bridge methods

- **Re-examine's** assistant-resolution reuses this workflow's existing `decideAssistant(cadre, office)` function (originally written for Stage 2's cadre/office-based assistant routing) — chosen because it is inherently stage-independent, needing only current cadre and office.
- **Return to Previous Level's** target-resolution reuses **two** existing helpers together:
  - `getInitiatingEmployee(entries)` — already used by Stage 3D for the RO-initiated branch.
  - The `agmIndex` / `doManagerEntry` lookup — already used by Stage 3 for the DO-initiated branch.

  Both halves of the universal "DO → Manager (Admin.), RO → initiating official" rule already existed in this file, attached to different stages; the bridge method's job is only to pick between them based on `isRoChandigarh`, exactly as Stage 3D already does internally.

Full implementation: see Part 5.

---

## Part 8 — Integration Guide

For a **new** workflow extension:

1. Design the workflow-specific business rules and build `content.js` exactly as has always been done — stage detection, routing, remarks — with no floating-window concerns yet.
2. Reuse `content_add_reviewer.js` unmodified.
3. Once the core workflow is proven on live requests, add the `window.FCIWorkflow` bridge (Part 3) as the last step:
   - Declare the module-level cache.
   - Populate it at the point stage detection already runs.
   - Implement `getWorkflowContext()`, `executeReExamine()`, `executeReturnPrevious()` following the worked example in Part 5/7.
4. Extend `content.js`'s existing routing to precompute all three payloads before navigating away (Part 6), if the panel needs to persist onto the Add Reviewer page for this workflow.
5. Add `floating_window.js` / `floating_window.css` (unmodified, shared across all extensions) alongside the workflow's files.
6. Verify against the checklist in Part 12.

For an **existing** extension already in production, see Part 9.

---

## Part 9 — Migration Guide (Existing Extensions)

Applies to Audit Leave Assistant, NOC Passport Assistant, and any other already-deployed `content.js`.

1. Keep the current `content.js` unchanged as far as possible — no rewriting of proven stage-detection or routing code.
2. Confirm (per Part 0, Step 1) which values are already computed vs. missing, and add only the thin adapter layer needed to close the gap.
3. Add the module-level cache (Part 3) and wire the one-line population/recording calls into each existing stage branch individually.
4. Implement the two bridge methods, reusing whichever existing helper functions already resolve "relevant assistant" and "DO Manager / initiating official" for that specific workflow — these functions typically already exist in some form, attached to specific stages, as shown in Part 7.
5. Add the shared, unmodified `floating_window.js` / `floating_window.css`.
6. Run the full checklist in Part 12 before considering the migration complete, with particular attention to confirming the existing automatic (recommended) behaviour is byte-for-byte unchanged.

No redesign of the floating window itself should ever be required for a migration — only the workflow-specific adapter layer changes per extension.

---

## Part 10 — Coding Standards

- Business logic lives only inside `content.js`. Never in `floating_window.js`, never in `content_add_reviewer.js`.
- `floating_window.js` is UI only — no assistant names, office mappings, remarks, or stage logic of any kind.
- The bridge (`window.FCIWorkflow`) is the only channel between panel and `content.js`; direct method calls, no event dispatch, no command-string switching.
- sessionStorage is used only for the Review page → Add Reviewer page handoff, never for same-page panel-to-content.js communication.
- Existing routing architecture, and existing automatic (recommended) behaviour, must never be broken or altered to accommodate the framework.
- A missing bridge method fails loud (console) and silent (no user-visible error) — never silent in both senses.
- No stage numbers, internal variable names, or sessionStorage keys are ever shown in the panel UI.

---

## Part 11 — Governance & Versioning

### Architectural Layers

```
+--------------------------------------------------+
|             Floating Window Framework            |
| (Generic UI, Bridge calls, Status, Interaction)   |
+--------------------------------------------------+
                        │
                        ▼
+--------------------------------------------------+
|          Workflow-Specific content.js             |
| (Business Rules, Stage Detection, Routing Logic)  |
+--------------------------------------------------+
                        │
                        ▼
+--------------------------------------------------+
|        content_add_reviewer.js (Shared)           |
|  (Auto-fill Office, Employee, Remarks, Routing)   |
+--------------------------------------------------+
                        │
                        ▼
                 HRMS Add Reviewer
```

### Governance Principles

1. Business logic belongs only in `content.js`.
2. The floating window must remain workflow-agnostic, always.
3. Cross-page routing data continues to pass through sessionStorage only.
4. Existing automation is never rewritten solely to accommodate the floating window.
5. New workflow extensions integrate with this framework instead of building custom panels.
6. Return to Previous Level's DO/RO routing rule is universal across all workflows — no per-workflow override exists or is needed.

### Versioning Structure

- **Framework Version** — the floating window UI, the bridge contract shape, shared CSS.
- **Workflow Version** — Passport, Other Exam, Audit Leave, Transfer, Gratuity, Benevolent Fund, and future extensions, each independently versioned.

This separation allows framework-level improvements (e.g. new panel features) without forcing changes to any workflow's business logic, and vice versa.

---

## Part 12 — Testing Checklist

Before considering any integration or migration complete, verify:

- [ ] Existing automatic (recommended) behaviour is unchanged, byte-for-byte, from before the panel was added.
- [ ] Re-examine resolves the correct assistant and routes correctly.
- [ ] Return to Previous Level resolves the correct DO Manager or initiating official and routes correctly.
- [ ] No-recommendation state greys out the recommended display but leaves both alternatives active.
- [ ] Floating panel appears exactly once per page (no duplicate injection).
- [ ] Panel persists correctly onto the Add Reviewer page and correctly overwrites pre-filled fields when an alternative is chosen there.
- [ ] Add Reviewer page never auto-submits, regardless of which payload was used to fill it.
- [ ] Missing bridge methods log a specific, identifiable console warning rather than failing silently.
- [ ] No stage numbers, internal variables, or sessionStorage keys are visible anywhere in the panel UI.
- [ ] Existing sessionStorage keys used by `content_add_reviewer.js` remain valid and unchanged in meaning.

---

## Part 13 — Future Enhancements (Explicitly Deferred, Not Forgotten)

These are recorded so they aren't re-proposed as new ideas later, and so their absence from the current design is understood as deliberate:

- Confirmation dialog before dispatch — deferred; the Add Reviewer page's manual "Add" click already serves this purpose.
- Button disabled/loading states — deferred; the panel is never injected before the bridge is ready, so this state cannot occur under the current sequencing.
- Diagnostic/explanation UI for the no-recommendation state — deferred; "stuck and does nothing" is the accepted starting point for troubleshooting.
- Configurable button visibility, keyboard shortcuts, dark mode, minimise/expand, workflow progress indicators, diagnostic logging panel — all remain valid future ideas, implementable entirely within the framework layer without touching any workflow's `content.js`.
- Recent routing history, undo-last-routing, custom remark templates, multi-language interface, a statistics/workflow-analytics dashboard — all identified during earlier design discussion, all deliberately excluded from Version 1 to keep the framework lightweight, and all implementable within the framework layer alone if pursued later.
- `closePanel()` / `refreshPanel()` as panel-level UI controls, distinct from the three business commands — noted as a possible future addition, not a core requirement, since nothing in the current design creates a need for `content.js` to instruct the panel to close or refresh itself.

---

## Conclusion

The Floating Window Framework is a reusable control layer, not a replacement for existing automation. It sits on top of every workflow extension, preserves existing behaviour exactly, and provides two universal, always-available manual alternatives for whenever exceptional handling is required — with all business knowledge remaining, permanently, inside each workflow's own `content.js`.

This document is intended to serve both as a design reference for future development, and as a complete starting prompt for any future conversation or implementation effort involving this framework — per Part 0, a new conversation should begin by requesting the target workflow's current `content.js` and checking it against the compatibility contract before any design or code discussion proceeds.
