# Floating Window Framework — Design Specification, Onboarding Guide & Master Prompt
**FCI HRMS Browser Extensions — Consolidated Architecture v3**

### Document Changelog

- **v3 (Aug 2026)** — Incorporates findings from the first real migration of an existing extension (NOC Passport Assistant) into this framework. Corrections and additions: the Add Reviewer-page bridge variant is now fully specified, including the JS-execution-world requirement that was previously unstated (Part 2, Part 2A, Part 5); the `fp.*` namespace gained an `officeType` field (Part 6A); a new Portal & Organizational Constants Reference section was added (Part 6B); dropdown-matching whitespace/NBSP tolerance is now a stated requirement (Part 2, Part 10); the in-place-fill (non-navigating stage) exception to the precompute rule is now documented (Part 6); the shared panel-position limitation is confirmed as an accepted v1 constraint (Part 13).
- **v2 (Jun 2026)** — Original consolidated design, pre-real-world-migration.

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

**Note:** this exact interface — the same three method names — is implemented **twice**, by two different scripts, because the panel is present on two different pages (Part 6) and `content.js` only runs on one of them. On the Review page, `content.js` implements it as described above (computes payloads, navigates). On the Add Reviewer page, `content_add_reviewer.js` implements a second, lighter version of the same three methods — it does no routing computation at all, it only switches which of the three payloads `content.js` already precomputed is currently applied to the form, and re-fills in place (Part 2, Part 5). `floating_window.js` calls the same method names either way and cannot tell, or needs to tell, which implementation is behind them.

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
- **Explicitly invoking the panel's render function once the bridge is populated.** `floating_window.js` never self-initializes, polls, or listens for readiness — it exposes a render entry point (e.g. `FloatingWindow.render()`) and does nothing until `content.js` calls it. Invocation *is* the readiness signal; there is no separate event, timer, or lifecycle mechanism needed, because the only script capable of knowing when the bridge is populated is the one populating it.

### floating_window.js

Responsible only for:
- Exposing a render entry point that `content.js` calls once ready (see above).
- Creating the floating panel.
- Displaying workflow status and the recommended-action summary.
- Showing the two alternative-action buttons.
- Calling `window.FCIWorkflow` methods directly.
- Never containing workflow-specific data or routing logic of any kind.

**Injection-context requirement (confirmed via NOC Passport migration):** "calling `window.FCIWorkflow` methods directly" only works if `floating_window.js` executes in the *same JS world* as whichever script defines the bridge on that page. Chrome extension content scripts run in one of two separate JS execution contexts per page — the extension's own private context ("ISOLATED", the default) or the page's own native context ("MAIN", required by any script that needs the page's jQuery, as `content_add_reviewer.js` does for Select2). Two scripts in different worlds cannot call each other's functions or see each other's globals at all, even though they see the same DOM. Because `content.js` (Review page) runs in the default ISOLATED world and `content_add_reviewer.js` (Add Reviewer page) is forced into MAIN world by its own Select2 requirement, `floating_window.js` must be registered **once per page, in the world matching that page's bridge-defining script** — ISOLATED alongside `content.js`, MAIN alongside `content_add_reviewer.js` (Part 8, Step 6). It is the same file both times; only the `world` value in the `manifest.json` entry differs. This is not optional configuration — get it wrong and the panel renders but every button silently does nothing, with no error, because the two scripts are in effect in separate browser tabs that happen to be drawn on top of each other.

### content_add_reviewer.js

Requires one small, generic addition on top of its current, proven behaviour — not a rewrite. It continues to:
- Read sessionStorage.
- Fill Office, Employee, and Reviewer Remarks.
- Never decide routing — it only ever picks between payloads `content.js` already computed.

The one new piece: it reads a single additional key, `fp.chosen` (Part 6A), to know which of the three precomputed payloads to apply. This is a selector read, not a routing decision — the value of `fp.chosen` is set entirely by `content.js` (by default) or overwritten by the panel if the user picks an alternative on the Add Reviewer page itself (Part 6). `content_add_reviewer.js` never computes what `fp.chosen` should be; it only branches on the three fixed key-sets already named in Part 6A's namespace based on whatever value it finds there.

**It also implements the Add Reviewer-page half of the bridge** (Part 0's "implemented twice" note, Part 5) — `getWorkflowContext()`, `executeReExamine()`, `executeReturnPrevious()`, same names as `content.js`'s, but doing none of `content.js`'s routing computation. Each `execute*` method here just re-points `fp.chosen` at the already-precomputed payload for that action and re-runs the same fill routine used on initial load — no navigation, no reload, no new lookups. This exists specifically so a user can change their mind *after* the form has already been auto-filled but *before* clicking "Add" (Part 6) — the one calm, non-racing moment in the entire pipeline where a manual override is actually reachable, since every earlier point in the sequence is either mid-automation or about to trigger further automation.

**Dropdown-matching must tolerate the portal's own data inconsistency.** Live HRMS dropdown option text is not reliably single-spaced — the same office can render as `"DO JALANDHAR"` in one place and `"DO  JALANDHAR"` (double space) in another, and non-breaking spaces have also been observed. Any string a workflow's `content.js` writes as a routing target must therefore be compared against dropdown option text only after normalizing *both* sides — collapsing all whitespace (including NBSP) to single spaces and uppercasing — never compared raw. Within the normalized comparison, try an **exact match first**, falling back to a **substring match** only if no exact match exists; matching only by substring risks a shorter name (e.g. "AMIT KUMAR") wrongly matching a longer one that contains it (e.g. "AMIT KUMAR SINGH") before the intended target is even reached. This normalization belongs in `content_add_reviewer.js`'s dropdown-selection helper, once, rather than in any individual workflow's `content.js` — it's a portal data-quality fact, not a business rule (see Part 6B).

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
        (floating_window.js re-injected in the SAME world as
        content_add_reviewer.js — see Part 2's injection-context note)
                    │
        content_add_reviewer.js fills the form from whichever
        payload fp.chosen currently points to, and exposes its
        own (lighter) window.FCIWorkflow — same method names as
        content.js's, but switch-and-refill instead of compute-
        and-navigate (Part 0, Part 5)
                    │
                    ├── User leaves the filled payload as-is
                    │
                    └── User clicks an alternative button here instead
                                │
                                ▼
                    floating_window.js calls the SAME method name
                    it would have called on the Review page —
                    it cannot tell, and does not need to know,
                    that a different script is answering this time
                                │
                                ▼
                    content_add_reviewer.js's executeReExamine() /
                    executeReturnPrevious() sets fp.chosen to the
                    new payload and re-runs its own fill routine,
                    in place — no navigation, no page reload
                    │
                    ▼
        User reviews the filled form and clicks "Add" manually
        (this step never happens automatically, for any payload)
```

**The one principle this diagram exists to reinforce:** at no point in this sequence does the floating panel analyse the workflow, parse a table, or decide a routing outcome. It only displays what `content.js` has already decided, and relays which of the already-decided outcomes the user picked.

**Why in-place refill, not "go back and click on the Review page instead":** the obvious-sounding alternative — send the user back to the Review page and let them click there — does not actually create a safe moment to intervene. Returning to the Review page re-triggers `content.js`'s automatic pipeline from the top: it waits briefly, re-parses the table, re-decides the same recommendation, and re-navigates away again, within seconds. The user would be racing the same automation a second time, not pausing it. The Add Reviewer page, by contrast, is the one point in the entire sequence where nothing further happens automatically — the "Add" button has always been manual — which is precisely why the override has to be reachable *there*, in place, rather than by sending the user somewhere the pipeline is still running.

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
 FCI Workflow Assistant                        ≡
--------------------------------------------------
 Request
 NOCPASS12345

 Recommended Action
 Routing to MADHU DHAKA for admin. clearance    (display only, never a button)

 Alternative Actions
 [ Re-examine ]
 [ Return to Previous Level ]

 Status
 Ready
--------------------------------------------------
```

The Recommended Action line is plain text, not bracketed — brackets read as a disabled button, which misrepresents it. It is never clickable under any circumstance (Part 1).

### Visual Design Spec

Sourced directly from the Audit Leave Assistant's existing panel — adopted here as the standard look for every extension's floating panel, so that Passport, Other Exam, Audit Leave, and all future workflows are visually identical even though their business logic differs entirely. **Only the styling is adopted from that script — not its interaction model.** See the note at the end of this section.

**Container**
- Fixed position, top-right (`top: 80px; right: 20px`), width `340px`, `max-height: calc(100vh - 100px)` with vertical scroll if needed
- White background, `1px solid #d0d0d0` border, `10px` border-radius
- Shadow: `0 4px 16px rgba(0,0,0,0.15)`
- Font: `Arial, sans-serif`, base size `13px`

**Header**
- Bold `13px` title, color `#333`
- Drag handle icon (`≡`), color `#aaa`, `18px`, `cursor: move`

**Request / employee info block**
- Background `#f7f9fc`, `3px` solid left accent border in `#1D9E75` (green)
- Primary line `12px`, secondary details `11px` in `#666`

**Buttons (Re-examine / Return to Previous)**
- `2px` solid border, `6px` border-radius, `12px` font, grey fill (`#f7f7f7`) by default
- Each action carries its own accent color on hover — assign one consistent color per action across all workflows (e.g. Re-examine uses the orange family `#D85A30` / hover `#FAECE7` / hover-border `#993C1D`; Return to Previous uses the green family `#1D9E75` / hover `#E1F5EE` / hover-border `#0F6E56`), so the same action always looks the same regardless of which workflow's panel it appears in.

**Status line**
- `12px`, muted grey by default; the "No recommendation detected" state (Part 4's States table) uses the same muted styling — no red or warning color, consistent with that state not being treated as an error.

**Load animation**
- On injection, panel border briefly transitions to `#1D9E75` with a stronger shadow (`0 8px 32px rgba(29,158,117,0.25)`) for ~800ms, then settles to the resting `#d0d0d0` border / standard shadow — a brief, subtle cue that the panel is ready, without requiring the user to visually search for it.

**Drag-to-reposition**
- Standard on every extension's panel, not per-extension optional (resolving the earlier open question on this point).
- Mechanism: `mousedown` on the header begins tracking, `mousemove` updates `left`/`top` directly (switching off the initial `right`-anchored position), `mouseup` ends tracking.
- Position persisted to `localStorage` (not sessionStorage — this is a UI preference, not routing data, and there is no cross-page handoff need for it) under a per-workflow key, and restored on the panel's next injection.

**On the Audit Leave source script:** its panel is not built on the Bridge architecture in Parts 1–3 — it computes routing and assembles remarks entirely inside the panel-injection file itself, with no `content.js`/`floating_window.js` separation and no automatic recommended action (both its options are always user-selected). It predates the design this document establishes. Only the colors, spacing, drag mechanism, and load animation described above are carried forward; its interaction model is not, and it should not be read as a reference implementation of the framework described elsewhere in this document.

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

- **No disabled/loading state tied to async readiness.** The panel is only injected after `content.js` has already finished parsing the action history table (per the existing, already-correct sequencing: click View Action History → wait for table → parse → *then* show panel, and per Part 2's render-invocation rule). There is no window where the panel exists but the bridge isn't ready, so no loading state is needed.
- **No confirmation dialog before Re-examine or Return to Previous.** The HRMS Add Reviewer page itself never auto-submits — the user always presses "Add" manually. That existing checkpoint is the real backstop; a second confirmation inside the panel would be redundant friction on paths that are already one click away from a human-reviewed, human-submitted form.
- **No select-preview-commit two-step for the alternative actions.** Audit Leave's older panel shows the assembled remark in a preview box before a separate commit click. The framework keeps Re-examine and Return to Previous as direct single-click actions instead, consistent with the no-confirmation-dialog decision above.

---

## Part 5 — Floating Panel API & Bridge Implementation

**A note on what this part is:** the code below is the actual worked instantiation of the bridge pattern for the **Other Exam NOC** workflow specifically — it uses that workflow's real helper functions (`decideAssistant()`, `getInitiatingEmployee()`, `AGM_DESIGNATION`) and is cross-referenced in full in Part 7. A different workflow's `content.js` will have differently-named equivalents for "resolve the relevant assistant" and "resolve the DO Manager / initiating official" — the *shape* of the two bridge methods (what they must do, and that they write the standard `fp.*` namespace before navigating) is the reusable part; the specific function names called inside them are not. When building a new workflow's bridge, substitute that workflow's own equivalent helpers rather than copying these names verbatim.

### Re-examine — resolves the "relevant assistant" via cadre/office lookup

This reuses whatever cadre/office → assistant lookup a workflow already implements for its normal assistant-routing stage (Stage 2, in this Other Exam NOC instantiation), since that logic is inherently stage-independent — it only needs current cadre and office, not which stage matched.

```javascript
executeReExamine() {
  const cadreValue  = _fciWorkflowCache.cadreValue;
  const officeValue = _fciWorkflowCache.officeValue;
  const assistant = decideAssistant(cadreValue, officeValue); // this workflow's own lookup

  if (!assistant) {
    console.warn('[FCI Workflow Assistant] Re-examine: could not resolve assistant for Cadre="'
      + cadreValue + '", Office="' + officeValue + '". No action taken.');
    return; // no-match = no-action, same rule as everywhere else in the codebase
  }

  sessionStorage.setItem('fp.chosen',                    'reexamine');
  sessionStorage.setItem('fp.route.reexamine.name',      assistant.name);
  sessionStorage.setItem('fp.route.reexamine.emp',       assistant.empNo);
  sessionStorage.setItem('fp.route.reexamine.office',    RO_CHANDIGARH);
  sessionStorage.setItem('fp.remark.reexamine',
    'Kindly re-examine the request in light of the applicable rules and circulars of the Corporation.');
  clickAddReviewer();
}
```

### Return to Previous Level — resolves DO Manager or Initiating Official

```javascript
executeReturnPrevious() {
  const isRoChandigarh = _fciWorkflowCache.isRoChandigarh;
  const officeValue    = _fciWorkflowCache.officeValue;
  const entries        = _fciWorkflowCache.entries;

  let targetName, targetOffice;

  if (isRoChandigarh) {
    const initiatingEmployee = getInitiatingEmployee(entries); // this workflow's own helper
    if (!initiatingEmployee) {
      console.warn('[FCI Workflow Assistant] Return to Previous: could not identify initiating official. No action taken.');
      return;
    }
    targetName   = initiatingEmployee.name;
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
    targetOffice = officeValue.trim().replace(/\s+/g, ' ').toUpperCase();
  }

  sessionStorage.setItem('fp.chosen',                       'returnprevious');
  sessionStorage.setItem('fp.route.returnprevious.name',    targetName);
  sessionStorage.setItem('fp.route.returnprevious.office',  targetOffice);
  sessionStorage.setItem('fp.remark.returnprevious',
    'The observations recorded in the action history may kindly be perused, and the requisite clarification, confirmation, or documentation furnished for further processing of the request.');
  clickAddReviewer();
}
```

### The recommended path also participates in the namespace

Not shown above, since it lives inside each workflow's existing, unmodified stage-detection branches (Part 7) rather than in a bridge method — but every branch that currently acts automatically must, per Part 6, also write `fp.chosen = 'recommended'` and its own `fp.route.recommended.*` / `fp.remark.recommended` values before navigating, so that `content_add_reviewer.js` (Part 6A) always has a consistent, complete set of three payloads to choose from regardless of which one ends up used.

### Universal Remark Text (Reference)

| Action | Remark |
|---|---|
| Re-examine | "Kindly re-examine the request in light of the applicable rules and circulars of the Corporation." |
| Return to Previous Level | "The observations recorded in the action history may kindly be perused, and the requisite clarification, confirmation, or documentation furnished for further processing of the request." |

Both are deliberately generic — they do not reference a specific Sl. No. or a specific stage's observations, because these are manual override paths that can be triggered independent of which stage matched, and must read correctly regardless of context.

### The Add Reviewer-page bridge variant (confirmed via NOC Passport)

This is `content_add_reviewer.js`'s implementation of the same three method names — see Part 0's "implemented twice" note and Part 2. It does no cadre/office lookup and no action-history parsing; it only re-points `fp.chosen` and re-runs the same fill routine already used on initial page load.

```javascript
window.FCIWorkflow = {
  getWorkflowContext() {
    return {
      requestId: requestId,
      hasRecommendation: true,
      recommendedSummary: 'Currently filling as: ' + chosenLabel(chosen) + ' — routing to ' + payload.name
    };
  },
  executeReExamine() {
    switchPayload('reexamine');
  },
  executeReturnPrevious() {
    switchPayload('returnprevious');
  }
};

function switchPayload(key) {
  const newPayload = readPayload(key); // reads fp.route.<key>.* from sessionStorage
  if (!newPayload) {
    console.warn('[FCI Workflow Assistant] Cannot switch to "' + key + '" — payload not precomputed or incomplete.');
    return;
  }
  chosen  = key;
  payload = newPayload;
  sessionStorage.setItem('fp.chosen', key);
  fillForm(payload); // the same Office Type → Office → Employee → Reason routine used on initial load
}
```

Two things worth noting for any future workflow reusing this pattern:
- `getWorkflowContext()` here always returns `hasRecommendation: true` and describes the *currently applied* payload, not a stage-detected recommendation — there is no stage detection on this page. The panel's "Recommended Action" label ends up displaying "currently filling as..." text here rather than a true recommendation; this is an accepted minor wording mismatch between the two pages, not a bug.
- `fillForm()` must be written once and called from both the initial-load path and `switchPayload()` — duplicating the fill logic between them risks the two drifting out of sync.

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

### Exception: stages that never navigate (confirmed via NOC Passport Stage 3)

Not every "recommended" stage ends in `clickAddReviewer()`. Some workflows have a stage that fills a field in place on the Review page itself (e.g. Reviewer Remarks) and stops there — no navigation happens, so there is no Add Reviewer page to precompute payloads *for* at that moment. The precompute rule above implicitly assumes every recommended stage navigates; in-place-fill stages are the counterexample. For these, `content.js` should:
- Still set `hasRecommendation: true` and a `recommendedSummary` in its cache, so the panel displays correctly on the Review page.
- **Not** write a `fp.route.recommended.*` payload, since there is nothing to navigate to.
- Still make Re-examine and Return-to-Previous fully available — the live bridge (`executeReExamine()` / `executeReturnPrevious()`) covers this correctly on its own, since those two paths compute and navigate independently of what the recommended stage did, in-place-fill or not.

No code change to `content_add_reviewer.js` is needed to support this — it simply never receives an invocation from an in-place-fill stage, the same as if the user had chosen not to navigate at all.

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
fp.route.recommended.officeType

fp.route.reexamine.name
fp.route.reexamine.emp
fp.route.reexamine.office
fp.route.reexamine.officeType

fp.route.returnprevious.name
fp.route.returnprevious.office
fp.route.returnprevious.officeType

fp.remark.recommended
fp.remark.reexamine
fp.remark.returnprevious

fp.chosen        ← which of the three payloads content_add_reviewer.js should use
                    ("recommended" | "reexamine" | "returnprevious")
```

`fp.chosen` is the one key that didn't exist in the original per-workflow schemes — it's what lets the Add Reviewer-page panel (Part 6) tell `content_add_reviewer.js` which precomputed payload to apply, without `content_add_reviewer.js` ever needing to know why.

`officeType` was added in v3, confirmed necessary via NOC Passport. The Add Reviewer page's Office field is a cascading dropdown that only populates once an Office Type has been selected — `content_add_reviewer.js` cannot select an Office without first knowing which Office Type it belongs under. Every payload carries its own `officeType` value, even though for most workflows Recommended and Re-examine will always resolve to the same constant (e.g. always Regional Office) — only Return-to-Previous-Level tends to vary per request, since it can target either the originating Divisional Office or the Regional Office depending on where the request started. Carrying the field uniformly on all three payloads — rather than only where it varies — was a deliberate choice: it keeps every payload the same shape, so `content_add_reviewer.js` never needs to know which action-type is "the one that might have a different Office Type" — it just always reads `fp.route.<chosen>.officeType`, unconditionally, the same three lines of code regardless of which payload is active. The actual Office Type values (which value means RO vs DO on this specific dropdown) are portal-specific and belong in Part 6B, not here.

### Compatibility Layer — no forced migration

Existing extensions are not required to rename their current sessionStorage keys immediately. Wherever an extension already stores equivalent information under its own prefix (e.g. `fci_noc_assistant_name`), a small adapter — a handful of lines at the point routing data is written — maps the existing keys to the standard namespace alongside the originals:

```javascript
// Compatibility adapter — existing key stays authoritative, standard key added alongside it
sessionStorage.setItem('fp.route.reexamine.name', sessionStorage.getItem('fci_noc_assistant_name'));
```

This keeps every already-deployed extension working exactly as it does today, while giving `content_add_reviewer.js` (and any future generic tooling) one predictable namespace to read from going forward. New extensions, per Part 8's Integration Guide, write directly to the standard namespace from the start and never need the adapter.

---

## Part 6B — Portal & Organizational Constants Reference

*(New in v3.)*

### What this section is, and isn't

The parts above define reusable **patterns** — the bridge shape, the namespace, the precompute rule. This section instead accumulates reusable **data**: specific values confirmed true about the live HRMS portal or FCI's own administrative structure, verified once against a real page or a real request and then treated as settled rather than re-derived by each new workflow. It intentionally does not carry per-workflow business logic (e.g. *how* a specific workflow decides who the "relevant assistant" is) — that stays local to each workflow's own `content.js`, exactly as before. What belongs here is narrower: facts that are true because they're the same portal component, or the same organization, regardless of which workflow is asking.

Each entry is tagged by *why* it's expected to stay true, since the two kinds fail for different reasons:
- **[HTML]** — true because it's the same rendered page/component across every workflow that touches it. Breaks only if the portal's UI changes.
- **[ORG]** — true because it reflects FCI's actual administrative hierarchy. Breaks only if that hierarchy changes.

### Confirmed Constants

| Constant | Value | Type | Confirmed against |
|---|---|---|---|
| Add Reviewer page — Office Type dropdown, Regional Office | `4` | [HTML] | NOC Passport |
| Add Reviewer page — Office Type dropdown, Divisional Office | `5` | [HTML] | NOC Passport |
| Action History table — Designation column | `cells[5]` (of 8 total columns: S.No, Date of Action, Version, Action Taken, Employee Name, Designation, Division, Authority) | [HTML] | NOC Passport, Other Exam NOC |
| DO Manager (Admin.) identification | The **first** entry in the action history whose Designation is "Assistant General Manager" **and** whose Remark is not "N/A" → the entry immediately **preceding** it is the Manager (Admin.). ("First," not "last" — a request escalated through more than one AGM would otherwise resolve to the wrong return-point.) | [ORG] | NOC Passport, Other Exam NOC |
| RO CHANDIGARH-initiated requests — initiating official | The first entry in the action history. | [ORG] | NOC Passport |
| Dropdown option text may contain irregular internal whitespace (double spaces, NBSP) inconsistently across entries | — (not a fixed value; a data-quality fact) | [HTML] | NOC Passport (`DO JALANDHAR` vs `DO  JALANDHAR`, and others, in the same live dropdown) |

### A scoping note specific to this toolset

These are recorded as **confirmed-stable defaults for a single-user toolset**, not as guaranteed-universal rules asserted on FCI's behalf. This document's constants are being verified and used by one person, for personal workflow automation, not deployed as an official or organization-endorsed tool — so "confirmed against NOC Passport" means exactly that, and no more. If a future workflow's action-history table has a different column count or layout, or a request's routing history doesn't follow the AGM→Manager pattern above, treat it as a standalone case to verify independently rather than assuming this table applies — per the same policy already governing every other judgment call in this document.

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
2. Reuse `content_add_reviewer.js`, adding only the `fp.chosen` read described in Part 2 if it isn't already present.
3. Once the core workflow is proven on live requests, add the `window.FCIWorkflow` bridge (Part 3) as the last step:
   - Declare the module-level cache.
   - Populate it at the point stage detection already runs.
   - Implement `getWorkflowContext()`, `executeReExamine()`, `executeReturnPrevious()` following the worked example in Part 5/7.
4. Extend `content.js`'s existing routing so every stage branch writes its recommended payload into the `fp.*` namespace (Part 5, Part 6A) and precomputes the other two payloads before navigating away (Part 6) — see Part 9 for what this actually involves structurally.
5. Add `floating_window.js` / `floating_window.css` (unmodified, shared across all extensions) alongside the workflow's files.
6. **Register the new files in `manifest.json`, once per page, matching each page's `world`.** Add `floating_window.js` and `floating_window.css` to the Review page's `content_scripts` entry alongside `content.js` (default ISOLATED world, no change needed), **and** to the Add Reviewer page's entry alongside `content_add_reviewer.js` — critically, in whichever `world` that entry already declares (Part 2's injection-context note). If `content_add_reviewer.js`'s entry specifies `"world": "MAIN"` (as it does today, for Select2 access), `floating_window.js` must be listed in that same entry, not a separate one — two separate entries matching the same URL pattern do not share a world just because they match the same page. No separate permissions are required beyond what the existing content scripts already declare, since the bridge communicates entirely in-page.
7. Verify against the checklist in Part 12.

For an **existing** extension already in production, see Part 9.

---

## Part 9 — Migration Guide (Existing Extensions)

Applies to extensions that already have an automatic, stage-detected "recommended" behaviour — NOC Passport Assistant, Other Exam NOC Assistant, and any future extension built the same way. **Does not apply to Audit Leave Assistant** — see the note at the end of this part.

1. Keep the current `content.js` unchanged as far as possible — no rewriting of proven stage-detection logic itself.
2. Confirm (per Part 0, Step 1) which values are already computed vs. missing, and add only the thin adapter layer needed to close the data/API gap.
3. Add the module-level cache (Part 3) and wire the one-line population/recording calls into each existing stage branch individually.
4. Implement the two bridge methods, reusing whichever existing helper functions already resolve "relevant assistant" and "DO Manager / initiating official" for that specific workflow — these functions typically already exist in some form, attached to specific stages, as shown in Part 7.
5. **Be aware this migration touches every stage branch, not just the bridge methods — this is not a purely additive change.** Supporting the Add Reviewer-page override (Part 6) means each existing stage branch must be edited at the point it currently computes one target and calls `clickAddReviewer()` immediately: it now needs to also compute the other two payloads and write `fp.chosen` plus all three `fp.route.*` / `fp.remark.*` values before that same call. For a workflow with a dozen stage branches (as in Part 7's worked example), that's a dozen small edits to existing, working code — not a single insertion point. This is more work than adding the bridge methods themselves, and should be planned for as such, not treated as a zero-effort add-on.

   **Check whether any existing stage branch never navigates** (fills a field in place and stops, rather than calling `clickAddReviewer()`) — confirmed to occur in NOC Passport's Stage 3. That branch needs the exception in Part 6, not the precompute treatment: set `hasRecommendation`/`recommendedSummary` for panel display, skip writing a `fp.route.recommended.*` payload, and change nothing else. Confirm this before assuming every stage branch needs the same edit — they don't.
6. Add the shared, unmodified `floating_window.js` / `floating_window.css`, and register them in `manifest.json` per Part 8, Step 6.
7. Run the full checklist in Part 12 before considering the migration complete, with particular attention to confirming the existing automatic (recommended) behaviour is byte-for-byte unchanged.

**On Audit Leave Assistant specifically:** its current panel computes routing and assembles remarks entirely within the panel itself, with no automatic recommended action and no `content.js`/`floating_window.js` separation (Part 4 has more detail). Migrating it into this framework is not a retrofit of the kind described above — it would first require building an automatic stage-detection and recommended-action layer that doesn't currently exist, before the bridge pattern would even apply. That is a materially larger undertaking than any migration step listed here, and is out of scope for this document.

---

## Part 10 — Coding Standards

- Business logic lives only inside `content.js`. Never in `floating_window.js`, never in `content_add_reviewer.js`.
- `floating_window.js` is UI only — no assistant names, office mappings, remarks, or stage logic of any kind.
- The bridge (`window.FCIWorkflow`) is the only channel between panel and `content.js`; direct method calls, no event dispatch, no command-string switching.
- sessionStorage is used only for the Review page → Add Reviewer page handoff, never for same-page panel-to-content.js communication.
- Existing routing architecture, and existing automatic (recommended) behaviour, must never be broken or altered to accommodate the framework.
- A missing bridge method fails loud (console) and silent (no user-visible error) — never silent in both senses.
- No stage numbers, internal variable names, or sessionStorage keys are ever shown in the panel UI.
- Any string used to match against a live-portal dropdown option is normalized (whitespace collapsed, NBSP stripped, case-folded) on both sides before comparison — exact match attempted before substring match — since live HRMS data is confirmed inconsistently spaced across entries (Part 6B).
- `floating_window.js` is registered in the same `world` as whichever script defines `window.FCIWorkflow` on that page (Part 2, Part 8) — verify this explicitly for any new page the panel is added to, rather than assuming the default world is correct.

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
- [ ] `floating_window.js` is registered in the correct `world` on every page it's added to (Part 2, Part 8) — verify by confirming a button click on that page actually reaches the bridge, not just that the panel renders.
- [ ] Return to Previous Level tested against at least one Divisional Office target with irregular internal whitespace in its dropdown option text (e.g. a double-spaced office name), not only against the Regional Office path.
- [ ] Switching payloads on the Add Reviewer page (Re-examine / Return-to-Previous, clicked from that page) refills correctly in place, with no page reload and no residual data from the previously-filled payload left in any field.
- [ ] Any non-navigating ("in-place-fill") stage branch is confirmed to still show a correct panel state, without a `fp.route.recommended.*` payload having been written for it (Part 6).

---

## Part 13 — Future Enhancements (Explicitly Deferred, Not Forgotten)

These are recorded so they aren't re-proposed as new ideas later, and so their absence from the current design is understood as deliberate:

- Confirmation dialog before dispatch — deferred; the Add Reviewer page's manual "Add" click already serves this purpose.
- Button disabled/loading states — deferred; the panel is never injected before the bridge is ready, so this state cannot occur under the current sequencing.
- Diagnostic/explanation UI for the no-recommendation state — deferred; "stuck and does nothing" is the accepted starting point for troubleshooting.
- Configurable button visibility, keyboard shortcuts, dark mode, minimise/expand, workflow progress indicators, diagnostic logging panel — all remain valid future ideas, implementable entirely within the framework layer without touching any workflow's `content.js`.
- Recent routing history, undo-last-routing, custom remark templates, multi-language interface, a statistics/workflow-analytics dashboard — all identified during earlier design discussion, all deliberately excluded from Version 1 to keep the framework lightweight, and all implementable within the framework layer alone if pursued later.
- `closePanel()` / `refreshPanel()` as panel-level UI controls, distinct from the three business commands — noted as a possible future addition, not a core requirement, since nothing in the current design creates a need for `content.js` to instruct the panel to close or refresh itself.
- **Per-workflow panel position** — confirmed as a real limitation, not just a theoretical one, via NOC Passport: `floating_window.js` is workflow-agnostic by design, so it has no mechanism to know whether it's currently serving Passport, Other Exam, or a future workflow, and therefore no way to key a dragged position to "this workflow's panel" specifically. v1 uses one shared localStorage key across every workflow — dragging the panel on any one extension moves it for all of them. Deliberately accepted rather than fixed now, since it would require either threading a `workflowKey` through the bridge (new required field on every `content.js`) or deriving one from the URL (fragile if two workflows' Review pages aren't reliably distinguishable by path). Revisit only if shared positioning is actually experienced as a problem in daily use, not preemptively.

---

## Conclusion

The Floating Window Framework is a reusable control layer, not a replacement for existing automation. It sits on top of every workflow extension, preserves existing behaviour exactly, and provides two universal, always-available manual alternatives for whenever exceptional handling is required — with all business knowledge remaining, permanently, inside each workflow's own `content.js`.

This document is intended to serve both as a design reference for future development, and as a complete starting prompt for any future conversation or implementation effort involving this framework — per Part 0, a new conversation should begin by requesting the target workflow's current `content.js` and checking it against the compatibility contract before any design or code discussion proceeds.
