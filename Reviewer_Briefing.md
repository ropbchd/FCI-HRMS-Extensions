# Reviewer Briefing — FCI HRMS Workflow Extensions

Read this before auditing any files. It exists because past reviews have flagged
things that are actually intentional architecture, or made claims against files
that weren't provided — both waste your time and mine. Ground every finding in
the actual file content given to you, not in general Chrome-extension best
practices or assumptions about what similar codebases usually look like.

## What this project is

Personal-use Chrome extensions (MV3) that automate my own workflow-routing and
remark-generation on FCI's internal HRMS portal (hrmsfci.in), as part of my
admin/HR role at Food Corporation of India, Regional Office Punjab. Not a
commercial product, not multi-user, not exposed to untrusted third parties —
built for a single operator (me) on a single account, on one portal.

This shapes what actually matters:
- No auth/session security review needed — I already have legitimate portal access.
- No multi-tenant data isolation needed — there's exactly one user.
- Convenience and reliability on *this specific portal's* DOM quirks matter far
  more than generic web-security hardening that would matter for a public product.

## Current architecture — read this before flagging "bugs"

### 1. Floating Window Framework (stable, already shipped)
A reusable UI framework governing all my workflow extensions. Documented in
`Floating_Window_Architecture_v3.md`. Key decisions a reviewer should treat as
**settled, not open questions**:

- **Bridge/API pattern**: `content.js` (or the relevant page's content script)
  exposes `window.FCIWorkflow`; `floating_window.js` calls it directly. This is
  the intended coupling — flag it only if the bridge contract itself is broken,
  not because two scripts share a `window` object.
- **World separation is deliberate, not a bug.** Different pages in the same
  multi-page workflow intentionally run in different JS worlds (ISOLATED vs
  MAIN) per `manifest.json`'s injection rules, because different pages need
  different levels of access to the portal's own jQuery/Select2 instances.
  Cross-page state does **not** flow through shared `window` state — it flows
  through `sessionStorage` handoff to the next page's content script
  (`content_add_reviewer.js` reads it on load). If you see two scripts in
  different worlds and no obvious shared-memory link, that's expected — check
  whether the sessionStorage handoff is correct, not whether `window` is shared.
- **HRMS portal quirks are known and already worked around**: dropdown values
  can contain double spaces or NBSP characters requiring normalization before
  string matching; the DO Manager identification rule is "first AGM with a
  non-N/A remark, entry before it is Manager." Don't flag string-matching code
  that looks unusually defensive — it's defending against a documented quirk,
  not paranoia.
- **A prior, already-diagnosed Select2/jQuery bug**: `waitForJQuery()` timing
  out and falling back to native `dispatchEvent('change')` doesn't reach
  HRMS's jQuery-bound cascade handler, so dropdowns silently fail to cascade.
  If you see selector/dropdown code, check whether it triggers change via
  jQuery/Select2 (`window.jQuery(el).trigger('change')`) — that's the fix
  pattern already adopted, not a workaround to flag as fragile.

### 2. Learning Layer (newer, actively under construction)
A framework-level (not extension-specific) addition sitting on top of the
Floating Window Framework, meant to hand-hold on any HRMS page — even ones
with no dedicated extension yet — and optionally let me manually promote a
well-learned pattern into a proper hand-authored extension later. Lives under
`learning/`: `storage.js` (Dexie/IndexedDB), `page-type-scorer.js` (heuristic
DOM+URL classifier), `patterns.js` (multi-strategy selector matcher +
execution engine), and an orchestrator (`index.js`) tying them together.

Settled design decisions here, again treat as intentional:
- **No network calls, no external credentials, no cloud dependency anywhere.**
  Offline-first is a hard requirement, not an oversight. Don't suggest adding
  API calls, telemetry, or remote sync.
- **Pattern storage is keyed by `requestType::pageSignature`, deliberately
  *not* including flow/sequence identifiers.** This is intentional: it lets
  two different multi-step flows that happen to share an identical page shape
  reuse the same learned pattern instead of relearning it per flow. If you
  spot a genuine collision risk (two *different* stages of the *same* request
  type sharing identical DOM anchors but needing different actions), flag the
  scenario specifically — don't propose changing the key schema to
  `requestType::flowId::sequenceIndex::pageSignature`, since that reintroduces
  the duplication the design avoids.
- **Status lifecycle**: `learning → trusted → promoted`. `trusted` is an
  *automatic* transition (5 consecutive successful executions + confidence
  ≥ 0.8) that lets a pattern stop requiring per-run confirmation. `promoted`
  is a *manual-only* action (a "Promote to Extension" button, not yet built)
  that generates a standalone hand-authored extension and retires the pattern
  from runtime execution. Don't conflate these two — a reviewer suggesting
  "remove auto-promotion because the plan says manual-only" is talking about
  the wrong transition; manual-only applies to `promoted`, not `trusted`.
- **Action-selector ties always require user confirmation**, regardless of
  pattern trust status — this is a deliberate safety gate because a wrong
  guess on a selector feeding a click/submit/set-value action means a
  misfired action on a live HRMS approval record, not a cosmetic bug.
- **Dexie is an intentional, explicit dependency choice** (not an oversight
  to "simplify back to raw IndexedDB") — chosen because the learning layer
  needs to continuously log, filter, and query complex execution history, and
  raw IndexedDB boilerplate for that is worse, not safer.

## What actually matters to flag

Given the above, useful review focuses on:
- Logic bugs: does the code actually do what its own comments/names claim?
- Wiring gaps: is a module that exists actually *called* by anything (e.g. is
  it listed in `manifest.json`'s `content_scripts`, or dead code sitting
  unreferenced)?
- Confidence/promotion math: does a failed execution ever *increase* trust in
  a pattern? (It shouldn't — check the actual formula, not just its presence.)
- Dexie/IndexedDB API misuse: primary-key vs. indexed-field confusion,
  constraint errors on upsert, etc. — these are easy to get subtly wrong.
- Whether confirm-gating is actually reachable in code, not just described in
  a comment.
- Anything that could cause a **silent misfire on a live HRMS approval
  action** — this is the single highest-severity category given what these
  extensions touch. A UI bug is low severity; an unconfirmed wrong-selector
  click on an approval workflow is high severity.

## What to explicitly avoid

- Don't propose enterprise/multi-tenant security hardening (rate limiting,
  auth scoping, XSS-from-other-users) — there's one user, one account.
- Don't propose adding network calls, cloud sync, telemetry, or third-party
  API integrations (e.g. GitHub API with a stored PAT) as "convenience" —
  offline-only is a hard constraint here.
- Don't flag a finding against a file you haven't actually been given the
  current content of. If a claim is about `content.js` or
  `content_add_reviewer.js` and you were only given a filename, say so
  explicitly and ask for the file rather than asserting what it contains.
- Don't assume a file is broken/truncated without checking the actual end of
  the provided content — confirm the closing braces/exports are present
  before claiming a compile error.

## How to structure findings

For each finding: name the file, quote or describe the specific line/function,
state why it's wrong (not just "this could be improved"), and mark severity as
one of: **Blocks execution** (won't load/run) / **Safety risk** (could cause a
wrong action on a live HRMS record) / **Correctness bug** (wrong behavior, not
safety-critical) / **Style/hardening** (works fine, optional improvement).
