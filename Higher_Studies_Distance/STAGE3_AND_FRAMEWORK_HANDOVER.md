# Handover — Higher Studies Distance: Stage 3 Panel Build + Framework Migration + Stage 3B Fix

**Audience:** IDE coding agent implementing this extension's next version.
**Role boundary:** This document specifies *what* to build and *why*. It does not contain
implementation code. If anything below is ambiguous, or if implementing it as written would
require a design decision not covered here, **stop and ask** rather than filling the gap with
an assumption — this file routes real HR approval workflows at FCI, Regional Office Punjab.

**Source of truth documents to read before starting** (in this repo):
1. `floating-window-framework/core/floating_window.js` + `floating_window.css` — the canonical,
   workflow-agnostic panel framework. Do not fork or duplicate its logic; copy these two files
   verbatim into `Higher_Studies_Distance/` (Chrome extensions require content scripts to live
   inside their own extension folder — this mirrors how `noc-other-examination/` already has its
   own physical copy of the same two files). If you find you need a framework-level behavior
   change to satisfy something below, make that change in the canonical `core/` copy first, then
   re-copy — never let `Higher_Studies_Distance/`'s copy silently diverge from canonical.
2. `Floating_Penal/` (architecture spec, v3) — the full design contract for the bridge
   (`window.FCIWorkflow`), the three-payload precompute model, and the panel's UI/behavior rules.
   Everything under "Framework Migration" below is an application of that spec to this workflow;
   this document does not restate all of it, only the Higher-Studies-Distance-specific decisions.
3. `noc-other-examination/content.js` — the only extension currently migrated to the framework.
   Use it as the structural reference for *how* to wire the bridge (cache object, `writeFpPayload`
   helper, `_fciWorkflowCache`, the `else if (stage3) { ... } else if (stage3b) { ... }` priority
   chain, `window.FCIWorkflow = { ... }` at the bottom) — not for its business rules, which are a
   different workflow's and do not apply here (see "Explicitly rejected approach" below).

---

## 1. Current State (confirmed by direct repo inspection, not assumed)

- `Higher_Studies_Distance/content.js` has exactly one commit in its history (`b05bd96`, initial
  upload). It contains full stage detection for Stages 1, 1B, 1C, 2, 3B, 3C — but **no Stage 3
  panel exists in code at all**. The file's only handling for the unmatched case is:
  ```
  } else {
    console.log(LOG + ' No automated stage matched. Manual Stage 3.');
  }
  ```
- `SPEC.md` and `CHANGELOG.md` in this folder describe a fully-featured Stage 3 floating panel
  (prerequisite checkboxes, S19/R19/T19 dropdowns, `buildStage3Remark()`, a "Send Back to DO"
  button) as if it exists. **It does not.** Treat `SPEC.md`'s "Stage 3 — Dynamic Remark (Manual)"
  section as the *spec* for what to build, not as documentation of what's already there — with
  one deliberate deviation noted in §3 below (the "Send Back to DO" button is dropped, superseded
  by the framework panel's Return-to-Previous-Level action).
- `manifest.json` does not reference `floating_window.js`/`floating_window.css` anywhere. The
  framework is not wired into this extension at all yet.
- `content_add_reviewer.js` has no `fp.*` sessionStorage handling and no bridge implementation —
  it only reads the older `fci_hs_*` keys.

## 2. Why the previous Stage 3B logic is being removed, not patched

The current `content.js` (lines 211–257) auto-navigates to the DO Manager whenever the last
Assistant's remark is non-empty and AMIT is next in `Pending Review`/`N/A`. This was diagnosed
against a real request (HISTUDIES16878) where the Assistant's remark was a full, legitimate
approval writeup — and the extension still auto-routed it backward to the DO, which is wrong.

**Explicitly rejected approach:** `noc-other-examination/content.js` solves an analogous ambiguity
using a fixed key sentence (`STAGE3_KEY_SENTENCE`) that its Assistants are trained to type when a
request is genuinely "in order." **Do not port this mechanism to Higher Studies Distance.** There
is no equivalent established phrase convention for this workflow's Assistants, and introducing one
would mean asking real officers to change how they write remarks — out of scope, rejected by the
project owner.

**Adopted approach instead:** stop trying to infer intent from remark content at all. Replace the
auto-navigating Stage 3B block with a **manual dual-panel fork** (§3).

## 3. Required Behavior — Manual Dual-Panel Fork

### 3.1 Gating condition (replaces `stage3bAssistantIssue` / `stage3b`)

Define a new condition — call it `assistantHandoffPending` — using the **same base pattern**
`stage3bAssistantIssue` used, minus the remark-content check:

- `lastAssistantReviewed` exists (an entry with `actionTaken === 'Reviewed'` whose `employeeName`
  matches one of `ASSISTANT_NAMES`)
- `afterAssistantReviewed` exists, its `employeeName` includes `MANAGER_NAME` ("AMIT KUMAR SINGH"),
  its `actionTaken.trim() === 'Pending Review'`, its `remark.trim() === 'N/A'`

This condition alone does **not** distinguish "office" (DO vs RO) and does **not** look at what
the Assistant's remark says — do not reintroduce `!isRoChandigarh` or any remark-content check
into this gate. (`isRoChandigarh` and the DO-Manager lookup are still used, unchanged, later — see
§4.2 — but only to resolve *who* Return-to-Previous-Level targets, never to decide *whether* to
show anything.)

### 3.2 What each condition state shows

- **If `assistantHandoffPending` is true AND `lastAssistantReviewed.remark.trim() !== ''`:**
  show **both** panels together:
  - The new Stage 3 evaluation panel (§3.3), so the officer can finalize approval directly if the
    remark reads as "OK."
  - The standard framework panel (§4), so the officer can Return-to-Previous-Level or Re-examine
    directly if the remark reads as "needs clarification."

- **If `assistantHandoffPending` is true AND `lastAssistantReviewed.remark.trim() === ''`:**
  do **not** show the Stage 3 evaluation panel. Per confirmation from the project owner, the live
  HRMS portal does not allow a Reviewed action to be submitted with a blank remark — so an empty
  remark reaching this code means **the extension's own scrape/parse is unreliable at that moment**,
  not that the Assistant genuinely left nothing to evaluate. Showing an empty evaluation panel here
  would be misleading. The framework panel (§4) is still shown regardless — it's a universal,
  always-available override (§4.1) — so Re-examine remains a safe way to re-route without acting on
  a possibly-incomplete parse.

- **If `assistantHandoffPending` is false:** neither panel triggers from this condition. Proceed to
  the rest of the existing priority chain (Stage 3C, Stage 2, Stage 1C, Stage 1B, Stage 1) exactly
  as today, with one adjustment: anywhere the old code referenced `!stage3b` to exclude Stage 3C
  from also matching, replace that reference with `!assistantHandoffPending` so the same mutual
  exclusion still holds under the new name.

### 3.3 Stage 3 Evaluation Panel — build from `SPEC.md`'s existing spec, with one change

Implement per `SPEC.md`'s "Stage 3 — Dynamic Remark (Manual)" and "Floating Panel Features"
sections in full:
- Prerequisite checkboxes (Admission brochure / Undertaking / Relevant circular attached?), with
  a warning dialog (not a hard block) if any are unchecked before generating.
- S19 dropdown (`NIL`/`1`/`2`, default `NIL`), R19 dropdown (`NIL`/`1`/`2`, default `2`), T19 text
  field (blank default; blank omits the IPR sentence).
- Reads Name of Course, University, From Date, To Date, Type, Duration, Office, Designation,
  Cadre from the page (existing `getFieldValue()` helper already does this pattern).
- Assistant clearance pattern detection: three hardcoded patterns scanned in the last Assistant's
  remark; on match, extract Sl. No./Remark references for inclusion; on multiple-match or
  no-match, prompt the officer with the option to proceed with a standard remark (no references).
  Full conditional logic lives in a `buildStage3Remark()` function, as `SPEC.md` already names it.
- "Generate Final Approval Remark" button (green) → builds the remark, shows it in a preview area.
- "Fill Remark" button (green) → pushes the generated text into `#editor` (mirror the existing
  `fillReviewerRemarks`-style pattern already used elsewhere in this codebase), auto-scrolls to it.
- "Clear" button (secondary).
- Draggable header.

**Deviation from `SPEC.md`:** drop the "Send Back to DO" button entirely. That job now belongs to
the framework panel's Return-to-Previous-Level action (§4), which already resolves the correct DO
Manager or RO initiating official per the framework's universal rule — a second, redundant
send-back control on this panel would just be two ways to do the same thing with two different
remark templates. Do not implement it.

**Deviation from NOC's precedent panel:** NOC's analogous panel (`showUnifiedCompliancePanel`)
auto-dismisses after 30 seconds, since it's a passive notice. **This panel must not auto-dismiss on
a timer.** Evaluating prerequisites, S19/R19/T19, and the clearance-pattern check against a real
request takes real time — a panel disappearing mid-review would destroy work in progress. Give it
an explicit **Cancel** (or Close) button instead, with no timer anywhere in its lifecycle.

## 4. Required Behavior — Framework Migration

### 4.1 Scope: full migration, universal, not scoped to the §3 fork

Per the architecture spec (`Floating_Penal/`) and per explicit confirmation from the project
owner: Re-examine and Return-to-Previous-Level must be **always shown, on every stage, regardless
of which stage auto-matched** — including on Stages 1, 1B, 1C, 2, and 3C, not only when §3's
`assistantHandoffPending` fork triggers. This matches `noc-other-examination`'s implementation
exactly; there is no Higher-Studies-Distance-specific narrowing of this rule.

### 4.2 Bridge implementation (`window.FCIWorkflow`)

Implement the same three-method bridge shape used by `noc-other-examination/content.js`:
- `getWorkflowContext()` → `{ requestId, hasRecommendation, recommendedSummary }`
- `executeReExamine()`
- `executeReturnPrevious()`

Follow NOC's pattern for the supporting pieces:
- A `_fciWorkflowCache` object, populated once action-history parsing completes.
- Precompute **all three** payloads (recommended / re-examine / return-previous) before any
  navigation, and persist them to `sessionStorage` under the `fp.*` keys, exactly as NOC does —
  not just the winning one. This is a hard requirement from the architecture spec (Part 0,
  "Precomputation Requirement"), because the panel must work correctly whether the officer acts
  from the Review page or from the Add Reviewer page.
- For `payloadReturnPrevious`: this workflow already computes everything needed —
  `isRoChandigarh` (line 135 of the current `content.js`) and `getDoManagerEntry`-equivalent logic
  (the `agmIndex`/`doManagerEntry` computation at lines 200–209). Reuse these exactly as they are;
  do not rewrite the DO-Manager lookup. Branch exactly as NOC's `content.js` does: if
  `isRoChandigarh`, target is the initiating official (first `Initiated` entry); otherwise, target
  is `doManagerEntry`.
- For `payloadReexamine`: target is `decideAssistant(cadreValue, officeValue)` (already exists,
  lines 345–365) — same assistant the extension would otherwise be routing to.
- `getWorkflowContext().recommendedSummary` should be a plain-language string with **no stage
  numbers or internal variable names** (architecture spec, Part 4/§10) — e.g. "Routing to Vishali
  Marwaha for admin. clearance," not "Stage 2."

### 4.3 `content_add_reviewer.js` — lighter bridge variant

Per the architecture spec (Part 2, "implemented twice"): add the same three method names here,
but with no routing computation — only re-pointing `fp.chosen` at an already-precomputed payload
and re-running the existing fill routine. Add support for reading `fp.chosen` and the `fp.route.*`
/ `fp.remark.*` keys, falling back to the existing legacy `fci_hs_*` keys if no `fp.*` payload is
found (mirror NOC's `readPayload()` / `readLegacyPayload()` pattern exactly — this preserves
backward compatibility for any in-flight sessionStorage from before this migration).

Also apply the whitespace/NBSP-normalization requirement (architecture spec, Part 2 and Part 10)
to this file's dropdown-matching helper if it does not already normalize both sides before
comparing — exact match attempted before substring match.

### 4.4 `manifest.json`

Add `floating_window.js` and `floating_window.css` to both the Review-page and Add-Reviewer-page
`content_scripts` entries, in the same `world` as whichever script defines the bridge on that page
— `ISOLATED` (default) alongside `content.js`, `MAIN` alongside `content_add_reviewer.js` — exactly
matching `noc-other-examination/manifest.json`'s structure. Verify this is correct by confirming a
button click on each page actually reaches the bridge, not just that the panel renders (architecture
spec, Part 12 testing checklist already names this exact failure mode: wrong `world` renders the
panel with buttons that silently do nothing).

## 5. Explicit Non-Goals — do not do these

- Do not introduce any key-sentence / fixed-phrase requirement on Assistant remarks (§2).
- Do not add a "Send Back to DO" button to the Stage 3 evaluation panel (§3.3).
- Do not add any auto-dismiss timer to the Stage 3 evaluation panel (§3.3).
- Do not change the detection logic for Stages 1, 1B, 1C, 2, or 3C beyond the minimal
  `!stage3b` → `!assistantHandoffPending` rename described in §3.2.
- Do not remove or repurpose any existing `fci_hs_*` sessionStorage key's meaning — only add new
  `fp.*` keys alongside them (architecture spec, Part 12: "existing sessionStorage keys ... remain
  valid and unchanged in meaning").
- Do not enable auto-submission anywhere. The officer still clicks "Add"/"Submit" manually in
  every case, exactly as today.
- Do not fork `floating_window.js`/`.css` — copy the canonical files verbatim (§0).

## 6. Testing Checklist (in addition to the architecture spec's own Part 12 checklist)

- [ ] Re-run against the HISTUDIES16878 action history (the case that surfaced this bug): with
      Vishali Marwaha's actual (non-empty, approval-style) remark, confirm the extension no longer
      auto-navigates to the DO Manager, and instead shows both the Stage 3 evaluation panel and the
      framework panel.
- [ ] Construct or find a case where the Assistant's remark genuinely is empty at parse time;
      confirm the Stage 3 evaluation panel does *not* appear, but the framework panel does, and
      Re-examine still functions correctly from it.
- [ ] Confirm Re-examine and Return-to-Previous-Level both appear and both function on Stages 1,
      1B, 1C, 2, and 3C — not only on the `assistantHandoffPending` fork.
- [ ] Confirm neither the Stage 3 evaluation panel nor the framework panel disappears on any
      timer; confirm both have a working Cancel/Close control.
- [ ] Confirm Return-to-Previous-Level correctly resolves to the DO Manager for a DO-origin
      request and to the initiating official for an RO-origin request (reusing the existing
      `isRoChandigarh` / `doManagerEntry` logic — §4.2).
- [ ] Confirm no existing `fci_hs_*` sessionStorage behavior regressed for Stages 1, 1B, 1C, 2, 3C.
