# Floating Window Architecture — Part 0

Read This First (Bootstrapping / Compatibility Check)



This section exists so that this document can be pasted into a brand-new conversation and immediately begin useful work — instead of the new conversation having to rediscover the framework's assumptions from scratch.



The Framework Contract, in Four Lines

content.js remains the single source of truth for all business logic. It never changes its existing stage-detection or routing behavior.

content.js exposes a single global object, window.FCIWorkflow, with methods the floating window can call.

floating\_window.js knows nothing about any workflow. It only calls window.FCIWorkflow methods and renders whatever they return.

content\_add\_reviewer.js stays purely mechanical — reads sessionStorage, fills the form. It never contains routing logic, for any workflow, ever.

Required API Surface



Every workflow's content.js must expose:



window.FCIWorkflow = {

&#x20; getWorkflowContext(),   // returns { requestId, recommendedSummary, hasRecommendation, ... }

&#x20; executeReExamine(),     // triggers the Re-examine routing path

&#x20; executeReturnPrevious() // triggers the Return-to-Previous-Level routing path

}



Note: there is no executeRecommended(). The recommended path is not a floating-window command — it is content.js's existing default automatic behavior, unchanged. The panel only ever displays it.



Precomputation Requirement



Because the panel must work on both the Review page and the Add Reviewer page, content.js must compute all three possible routing payloads (recommended, re-examine, return-previous) before it ever navigates away from the Review page, and hand all three to sessionStorage — not just the winning one. content\_add\_reviewer.js will pick between the three already-computed payloads; it must never compute a routing decision itself.



No-Recommendation State



If stage detection finds no match, getWorkflowContext() should return hasRecommendation: false. The panel greys out the recommended-action display and shows "No recommendation detected" — but Re-examine and Return-to-Previous stay active regardless, since neither depends on stage-matching succeeding. This is the manual escape hatch when the extension is otherwise stuck.



Step 1 — Before Any Design or Code Discussion



If you're starting a new conversation with this document to build or extend a workflow extension, the first thing to establish is:



Do you already have a content.js for this workflow?



If yes — paste it now. It will be checked against two separate things:

Data check: does it already compute the values a panel needs (request ID, recommended-action summary, DO/RO origin, the "relevant assistant" for re-examine)? Most existing workflows likely already compute most of this as part of normal stage detection — parsing action history already surfaces this.

API check: does it already expose window.FCIWorkflow with the three methods above? For every extension built before this framework existed, the answer is no — this is new surface area, not something that was ever missing before.

Any gaps found are addressed by adding a thin adapter layer only — new code that reads values content.js already computes and exposes them through the required API shape. Existing stage-detection and routing code is never rewritten to accommodate this.

If no — the workflow-specific content.js is designed first, business rules and all, exactly as has been done for every extension so far. The window.FCIWorkflow bridge is the last piece added, once the routing logic itself is proven.

Step 2 — Compatibility Guard (Diagnostic, Not Defensive)



floating\_window.js should check for each required method before calling it, and if missing, log a specific console message (e.g. "executeReExamine() not found — this page's content.js hasn't implemented the floating window bridge yet.") rather than failing silently. Outward behavior is identical either way — nothing happens — but the console carries the breadcrumb needed to troubleshoot without re-deriving the cause from scratch.

# 

# Floating Window Architecture -- Part 1

## Purpose

This document describes the proposed floating window architecture for
the FCI HRMS browser extensions.

The floating window is intended to act as a **supplementary control
layer**. It should not replace the existing `content.js` workflow logic.
Instead, it provides optional actions that can be invoked when needed
while allowing the normal automation to continue unchanged.

## Design Philosophy

* Existing `content.js` remains the single source of truth.
* Existing stage detection remains unchanged.
* Existing routing logic remains unchanged.
* Floating window only exposes additional actions.
* Business logic stays inside `content.js`.
* The floating window sends commands; `content.js` executes them.

## Benefits

* Minimal changes to existing extensions.
* Reusable across Passport, Other Exam, Audit Leave and future
workflows.
* Easier maintenance.
* Consistent user experience.

## Proposed Buttons

1. **Recommended Action**

   * Display only.
   * Shows the action inferred by `content.js`.
2. **Re-examine**

   * Sends the request back to the relevant assistant with the
remark: `Kindly re-examine the request.`
3. **Return to Previous Level**

   * If initiated at a Divisional Office: Return to Manager (Admin.).
   * If initiated at Regional Office: Return to the initiating
official.

## Integration Strategy

A separate floating-window script should be injected alongside the
existing extension.

Communication should occur through lightweight custom events or a shared
sessionStorage command so that `content.js` performs the actual routing.

This architecture keeps all routing knowledge in one place and allows
the floating window to remain generic across extensions.



# Floating Window Architecture -- Part 2

# Workflow \& Integration Architecture

## Core Principle

The floating window is **not** responsible for making workflow
decisions.

Instead:

* `content.js` continues to detect the current business stage.
* `content.js` continues to determine the correct routing.
* The floating window only provides a user interface for optional
actions.

\---

# Separation of Responsibilities

## content.js

Responsible for:

* Reading request data.
* Parsing action history.
* Detecting business stage.
* Determining routing.
* Preparing routing data.
* Executing routing.

## Floating Window

Responsible for:

* Displaying workflow status.
* Showing optional buttons.
* Sending user commands.
* Never containing workflow-specific routing logic.

\---

# Communication Model

&#x20;   User
│
▼
Floating Window
│
(Command)
│
▼
content.js
│
(Uses existing routing logic)
│
▼
Add Reviewer page
│
▼
Existing add-reviewer script



\---

# Proposed Commands

The floating window should send only generic commands such as:

* recommended
* reexamine
* return\_previous

The command may be passed using:

* sessionStorage
* CustomEvent
* window.postMessage

`content.js` interprets the command and performs the appropriate action.

\---

# Why This Architecture?

Advantages include:

* One source of business logic.
* Reusable floating window.
* Minimal modification to existing extensions.
* Easier debugging.
* Consistent behaviour across all request types.

\---

# Integration Steps

1. Existing extension loads normally.
2. content.js analyses the request.
3. Floating window is injected.
4. User may ignore the window.
5. Normal automation proceeds unchanged.
6. If an optional button is pressed, the command is passed to
content.js.
7. content.js performs the routing using its existing mechanisms.

\---

# Future Scalability

Every future workflow (Passport, Other Exam, Audit Leave, Benevolent
Fund, etc.) can reuse the same floating window.

Only the workflow-specific content.js understands:

* assistants
* managers
* remarks
* routing rules
* office mappings

The floating window remains completely generic.





# Floating Window Architecture -- Part 3

# Developer Implementation Guide

## Objective

This document defines the reusable implementation architecture for the
Floating Window Framework.

Unlike the previous parts, this document focuses on **how the framework
should be built**, not merely what it should do.

\---

# Proposed Folder Structure

&#x20;   Extension
│
├── manifest.json
├── content.js                 <-- Existing business logic
├── content\_add\_reviewer.js    <-- Existing Add Reviewer automation
│
├── floating\_window.js         <-- NEW
├── floating\_window.css        <-- NEW
└── icons/



The existing files continue to perform their current responsibilities.

Only two new files are introduced.

\---

# Responsibilities

## content.js

Remains the **single source of truth**.

Responsible for:

* Stage detection
* Reading HRMS page
* Parsing Action History
* Reading employee information
* Deciding routing
* Building remarks
* Opening attachments
* Clicking "Add Reviewer"

The floating window must **never duplicate this logic.**

\---

## floating\_window.js

Responsible only for:

* Creating the floating panel
* Displaying the detected workflow status
* Showing available buttons
* Sending generic commands back to `content.js`

It must not contain:

* Assistant names
* Office mappings
* Business rules
* Routing logic
* Stage logic

\---

## content\_add\_reviewer.js

No architectural changes.

It continues to:

* Read sessionStorage
* Fill Office
* Fill Employee
* Fill Remark
* Scroll to Add button

Exactly as it already does.

\---

# Communication Architecture

&#x20;   Review Page

&#x20;           │
▼

&#x20;   content.js
            │
            ├──────────────► floating\\\\\\\_window.js
            │                     │
            │                     ▼
            │              User presses button
            │                     │
            ◄─────────────────────┘
            │
            ▼
    Existing routing logic
            │
            ▼
    Click Add Reviewer
            │
            ▼
    content\\\\\\\_add\\\\\\\_reviewer.js










\---

# Generic Command API

The floating window should never know workflow details.

Instead it should emit only one of the following commands:

&#x20;   recommended
reexamine
return\_previous



`content.js` interprets these commands according to the current
workflow.

This allows every extension to reuse the same floating window.

\---

# Floating Window UI

Suggested layout

&#x20;   +------------------------------------+
|      FCI Workflow Assistant        |
+------------------------------------+

&#x20;   Current Request
NOCPASS12345

&#x20;   Recommended Action

    \\\\\\\[ Send to Assistant ]

    Alternative Actions

    \\\\\\\[ Re-examine ]

    \\\\\\\[ Return to Previous Level ]

    Status

    Waiting for user...










No stage numbers should appear.

The interface should speak only in business language.

\---

# Generic Event Handler (Skeleton)

``` javascript
document.addEventListener("FW\\\\\\\_COMMAND", function(e){

    switch(e.detail.command){

        case "recommended":
            // Existing workflow
            break;

        case "reexamine":
            // Existing workflow
            break;

        case "return\\\\\\\_previous":
            // Existing workflow
            break;

    }

});
```

Only this listener needs to be added to each `content.js`.

The rest of the routing remains unchanged.

\---

# Minimal Patch Philosophy

Every future extension should require only:

1. Inject floating window.
2. Register three commands.
3. Reuse existing routing functions.

No duplication of routing logic.

No rewriting of stage detection.

\---

# Coding Standards

The framework should always follow these rules:

* Business logic lives only inside `content.js`.
* Floating window is UI only.
* Commands must remain generic.
* sessionStorage continues to transport routing data.
* Existing routing architecture must not be broken.
* Existing workflow remains the default behaviour.
* Floating window only provides additional user choices.

\---

# Long-term Benefits

Following this architecture means every future extension---Passport,
Other Exam, Audit Leave, Transfer, Benevolent Fund, Gratuity and
others---can share one common floating window implementation while
keeping each workflow's business logic isolated inside its own
`content.js`.

This significantly reduces maintenance effort, improves consistency
across extensions and makes future enhancements available to every
workflow with minimal additional code.





# Floating Window Architecture -- Part 4

# Production Implementation \& Integration Guide

## Purpose

This document serves as the final implementation specification for
integrating the Floating Window Framework into existing and future FCI
HRMS browser extensions.

The objective is to create a **single reusable UI component** that works
across all workflow-specific extensions while requiring only minimal
changes to each `content.js`.

\---

# Overall Architecture

&#x20;                       Review Page
│
▼
Existing content.js
│
┌───────────────┴────────────────┐
│                                │
▼                                ▼
Stage Detection                 Floating Window
(existing logic)                  (new generic UI)
│                                │
│<────────User Commands──────────│
│
▼
Existing Routing Functions
│
▼
Click "Add Reviewer"
│
▼
content\_add\_reviewer.js
│
▼
Add Reviewer Form



The floating window **never performs routing itself**. It only requests
an action from `content.js`.

\---

# Production Files

Every extension should eventually contain:

&#x20;   manifest.json

&#x20;   content.js

&#x20;   content\\\\\\\_add\\\\\\\_reviewer.js

    floating\\\\\\\_window.js

    floating\\\\\\\_window.css










No additional workflow-specific floating window files should ever be
required.

\---

# Responsibilities

## content.js

Must expose three logical actions:

* Execute Recommended Action
* Execute Re-examine
* Execute Return to Previous Level

These actions internally reuse the extension's existing routing code.

No duplicate routing code should be introduced.

\---

## floating\_window.js

Responsibilities:

* Build floating panel
* Detect whether the panel already exists
* Display request number
* Display extension name
* Display recommended action text
* Display the three buttons
* Dispatch generic commands
* Show current status

Nothing else.

\---

## floating\_window.css

Responsible only for presentation:

* Position
* Colours
* Typography
* Responsive layout
* Minimise visual interference with HRMS

\---

# User Interface Specification

&#x20;   --------------------------------------------------

&#x20;   FCI Workflow Assistant

&#x20;   Request

    NOCPASS12345

    Recommended Action

    \\\\\\\[ Send to Assistant ]

    Alternative Actions

    \\\\\\\[ Re-examine ]

    \\\\\\\[ Return to Previous Level ]

    Status

    Ready

    --------------------------------------------------










The wording should always be business-oriented.

Never expose:

* Stage numbers
* Internal variables
* SessionStorage keys
* Assistant IDs
* Routing rules

\---

# Recommended Integration Pattern

Inside `content.js`

&#x20;   analyseWorkflow()

&#x20;   ↓

&#x20;   prepareRoutingData()

    ↓

    publishRecommendedAction()

    ↓

    showFloatingWindow()










If the user does nothing,

normal workflow continues.

If the user presses an alternative button,

the corresponding routing function executes instead.

\---

# Minimal Patch Required

Each existing extension only needs to implement:

1. Include `floating\\\\\\\_window.js`.
2. Include `floating\\\\\\\_window.css`.
3. Register the command listener.
4. Map three commands to existing routing functions.

Everything else remains unchanged.

\---

# Extension-Specific Responsibilities

The floating window should never know:

* which assistant
* which office
* which manager
* what remark
* what stage
* how routing works

Those remain entirely inside the workflow-specific extension.

\---

# Passport Workflow Example

Recommended

→ Existing Passport routing.

Re-examine

→ Send to the same assistant with the remark:

"Kindly re-examine the request."

Return to Previous Level

→ If request originated at a Divisional Office: Return to Manager
(Admin.)

→ If request originated at Regional Office: Return to the initiating
official.

No changes are required to the Add Reviewer automation.

\---

# Testing Checklist

Before deployment verify:

✓ Existing automation still works.

✓ Recommended action behaves exactly as before.

✓ Re-examine routes correctly.

✓ Return to Previous Level routes correctly.

✓ Floating window appears only once.

✓ Window survives page scrolling.

✓ Window does not interfere with existing controls.

✓ Existing sessionStorage values remain valid.

✓ Add Reviewer page continues to auto-fill correctly.

\---

# Future Enhancements

Possible additions include:

* Dark mode.
* Minimise / expand panel.
* Keyboard shortcuts.
* Confirmation dialog before dispatch.
* User-configurable button visibility.
* Workflow progress indicator.
* Diagnostic mode for debugging.
* Logging console for developer builds.

These enhancements should be implemented entirely within the floating
window and must not require modifications to business logic.

\---

# Starter Prompt for Future Development

Use the following when beginning work on a new extension:

> Implement the Floating Window Framework using the architecture defined
> in Parts 1--4. Preserve the existing `content.js` as the single source
> of truth. The floating window must remain workflow-agnostic, display
> the recommended action and two standard alternatives ("Re-examine" and
> "Return to Previous Level"), and communicate with `content.js` through
> generic commands. All routing decisions, remarks, office mappings and
> assistant selection must remain inside `content.js`. Existing Add
> Reviewer automation (`content\\\\\\\_add\\\\\\\_reviewer.js`) should continue
> unchanged.

\---

# Conclusion

The Floating Window Framework is intended to become the common user
interaction layer for every FCI HRMS browser extension. By separating
presentation from business logic, the framework ensures consistency,
maintainability and scalability while preserving the proven routing
architecture already implemented within each workflow-specific
`content.js`.





# Floating Window Architecture -- Part 5

# Production Code Reference \& Reusable Framework

## Objective

This document defines the implementation standards for the reusable
Floating Window Framework. It complements Parts 1--4 by describing the
production code layout and the reusable APIs that every workflow
extension should implement.

\---

# Guiding Principles

* `content.js` remains the single source of truth.
* `content\\\\\\\_add\\\\\\\_reviewer.js` remains the only Add Reviewer automation.
* `floating\\\\\\\_window.js` contains UI only.
* The floating window never stores workflow-specific routing data.
* All workflow-specific data remains inside `content.js`.

\---

# Production Components

## floating\_window.js

Responsibilities:

* Create the floating panel.
* Display request information.
* Display the recommended action supplied by `content.js`.
* Display two universal alternatives:

  * Re-examine
  * Return to Previous Level
* Send generic commands back to `content.js`.
* Display progress/status messages.

\---

## floating\_window.css

Defines:

* Panel position.
* Compact layout.
* Theme colours.
* Button styling.
* Collapsible behaviour (future enhancement).
* Responsive sizing.

\---

# Generic Command Contract

The floating window should emit only the following commands:

&#x20;   recommended
reexamine
return\_previous



Each workflow-specific `content.js` maps these commands to its own
routing functions.

\---

# Suggested Dispatcher

``` javascript
document.addEventListener("FW\\\\\\\_COMMAND", (e) => {
    switch (e.detail.command) {
        case "recommended":
            executeRecommendedAction();
            break;

        case "reexamine":
            executeReExamine();
            break;

        case "return\\\\\\\_previous":
            executeReturnPrevious();
            break;
    }
});
```

The dispatcher is generic and reusable across every extension.

\---

# Recommended Public API

Each `content.js` should expose (internally) functions equivalent to:

* `executeRecommendedAction()`
* `executeReExamine()`
* `executeReturnPrevious()`

Internally, these functions should reuse the existing routing
implementation instead of duplicating logic.

\---

# Passport Workflow Mapping

Recommended: - Execute the normal routing already detected by
`content.js`.

Re-examine: - Route to the relevant assistant. - Use the remark: "Kindly
re-examine the request."

Return to Previous Level: - If initiated at Divisional Office → Manager
(Admin.). - If initiated at Regional Office → Initiating official.

\---

# Reuse Strategy

For every future extension:

1. Copy `floating\\\\\\\_window.js`.
2. Copy `floating\\\\\\\_window.css`.
3. Register the generic dispatcher.
4. Implement the three command handlers by calling existing routing
functions.

No additional floating-window customisation should normally be required.

\---

# Quality Checklist

Before releasing an extension, verify:

* Existing automation is unchanged.
* Recommended action still follows existing workflow.
* Universal actions work correctly.
* No duplicate routing logic has been introduced.
* UI remains workflow-independent.
* Session storage usage remains compatible with existing code.

\---

# Long-term Vision

The floating window becomes a shared framework across all FCI HRMS
workflow extensions. Future improvements---such as better UI, keyboard
shortcuts, diagnostics or accessibility---can be made once inside the
framework and automatically benefit every extension without altering
business logic.





# Floating Window Architecture -- Part 6

# Complete Development Roadmap \& Framework Governance

## Purpose

This final part consolidates the architectural decisions made throughout
Parts 1--5 and establishes a governance model for the Floating Window
Framework. Its purpose is to ensure that all present and future FCI HRMS
browser extensions evolve under a common architecture, reducing
duplication, simplifying maintenance and improving consistency.

\---

# Vision Statement

The Floating Window Framework is **not an automation engine**.

It is a **workflow control interface** that sits on top of
workflow-specific automation.

Every workflow continues to implement its own business logic, while the
framework provides a common and consistent user interaction layer.

\---

# Architectural Layers

&#x20;   +--------------------------------------------------+
|             Floating Window Framework            |
| (Generic UI, Commands, Status, User Interaction) |
+--------------------------------------------------+
│
▼
+--------------------------------------------------+
|          Workflow-Specific content.js            |
| (Business Rules, Stage Detection, Routing Logic) |
+--------------------------------------------------+
│
▼
+--------------------------------------------------+
|        content\_add\_reviewer.js (Shared)          |
|  (Auto-fill Office, Employee, Remarks, Routing)  |
+--------------------------------------------------+
│
▼
HRMS Add Reviewer



Each layer has a clearly defined responsibility and should not duplicate
the responsibilities of another layer.

\---

# Governance Principles

The following rules should guide future development:

1. Business logic belongs only in `content.js`.
2. The floating window must remain workflow-agnostic.
3. Routing data continues to be passed through existing mechanisms
(e.g. `sessionStorage`).
4. Existing automation should never be rewritten solely to accommodate
the floating window.
5. New workflow extensions should integrate with the framework instead
of creating custom floating panels.

\---

# Standard User Actions

Every workflow should expose the same three conceptual actions:

* **Recommended Action**

  * Executes the normal workflow inferred by `content.js`.
* **Re-examine**

  * Sends the request back to the appropriate assistant with the
standard remark: `Kindly re-examine the request.`
* **Return to Previous Level**

  * Returns the request to the previous administrative level
according to the workflow's existing routing rules.

This consistency reduces the learning curve across all extensions.

\---

# Migration Strategy

When introducing the framework into an existing extension:

1. Keep the current `content.js` unchanged as far as possible.
2. Add the floating window scripts.
3. Register the generic command listener.
4. Map the three generic commands to existing routing functions.
5. Verify that the Add Reviewer automation behaves exactly as before.

\---

# Versioning Guidelines

Suggested version structure:

* Framework Version

  * Floating Window
  * Shared APIs
  * Generic UI
* Workflow Version

  * Passport
  * Other Exam
  * Audit Leave
  * Transfer
  * Gratuity
  * Benevolent Fund

This separation allows framework improvements without forcing changes to
workflow logic.

\---

# Future Enhancements

Potential future features include:

* Configurable button visibility.
* User preferences.
* Keyboard shortcuts.
* Compact/minimised mode.
* Diagnostic logging panel.
* Visual workflow timeline.
* Confirmation prompts before routing.
* Theme customisation.

These enhancements should be implemented within the framework and should
not require workflow-specific changes.

\---

# Recommended Development Workflow

1. Design the workflow-specific business rules.
2. Implement or update `content.js`.
3. Reuse the shared `content\\\\\\\_add\\\\\\\_reviewer.js` where applicable.
4. Integrate the Floating Window Framework.
5. Test the three standard user actions.
6. Validate the complete routing cycle.
7. Release.

\---

# Final Notes

The architecture documented in Parts 1--6 is intended to establish a
long-term foundation for FCI HRMS browser extensions.

By maintaining a strict separation between:

* user interface,
* workflow logic,
* routing,
* and form automation,

the framework becomes easier to understand, extend and maintain.

The result is a scalable ecosystem in which every new workflow can share
a common interaction model while preserving its own business rules and
routing requirements.

\---

# End of Documentation Series

Parts 1--6 together provide:

* Architectural vision.
* Design philosophy.
* Integration strategy.
* Developer implementation guide.
* Production reference.
* Governance and long-term roadmap.

They are intended to serve both as: 1. A design reference for future
development. 2. A comprehensive starting prompt for any future
conversation or implementation effort involving the Floating Window
Framework.





# Part 7 -- Implementation Guide \& Patch Architecture

## Objective

This document describes how the Floating Window should be integrated
into existing and future FCI HRMS browser extensions while keeping
workflow-specific logic inside `content.js`.

## Recommended File Structure

``` text
manifest.json
content.js
content\\\\\\\_add\\\\\\\_reviewer.js
floating\\\\\\\_window.js
floating\\\\\\\_window.css
floating\\\\\\\_window\\\\\\\_bridge.js
```

## Responsibilities

### content.js

* Detect workflow stage.
* Parse request details.
* Store routing data in sessionStorage.
* Expose helper/API functions:

  * `routeRecommended()`
  * `routeReExamine()`
  * `routeReturnPrevious()`
  * `getWorkflowContext()`

### floating\_window.js

* Create and manage the floating UI.
* Display:

  * Recommended Action
  * Re-examine
  * Return to Previous Level
* Invoke helper APIs exposed by `content.js`.
* Never duplicate business rules.

### content\_add\_reviewer.js

* Generic form filler.
* Reads sessionStorage only.
* Fills Office, Employee and Reviewer Remarks.
* Does not decide routing.

## Communication Flow

``` text
Review Page
      │
      ▼
content.js detects workflow
      │
      ▼
Floating Window loads
      │
      ▼
User clicks an action
      │
      ▼
content.js helper executes
      │
      ▼
Click Add Reviewer
      │
      ▼
content\\\\\\\_add\\\\\\\_reviewer.js
      │
      ▼
Reviewer form auto-filled
```

## Integration Steps

1. Add floating window files to the extension.
2. Inject the floating panel after workflow detection.
3. Register workflow metadata.
4. Expose helper functions from `content.js`.
5. Keep routing logic unchanged.
6. Let the floating window call the helper APIs.

## Standard Helper API

``` javascript
routeRecommended();
routeReExamine();
routeReturnPrevious();
getWorkflowContext();
```

## Universal Alternative Actions

### Re-examine

Route to the relevant assistant with:

> Kindly re-examine the request.

### Return to Previous Level

* DO initiated request → Manager (Admin.)
* RO initiated request → Request Initiating Official

The routing decision remains inside `content.js`.

## Testing Checklist

* Recommended action still works.
* Re-examine routes correctly.
* Return Previous routes correctly.
* Add Reviewer form fills correctly.
* Reviewer Remarks populate correctly.
* Existing workflow remains unaffected.

## Common Mistakes

* Duplicating routing logic inside the floating window.
* Reading workflow-specific fields directly from the UI.
* Hard-coding employee mappings in the floating window.
* Modifying existing business stages unnecessarily.

## Migration Guide

For each new workflow:

1. Copy the generic floating window files.
2. Add workflow bridge functions.
3. Register workflow metadata.
4. Reuse the same floating UI.

No redesign should be required.

## Summary

The floating window should remain a reusable UI layer. All workflow
intelligence continues to reside inside `content.js`, ensuring minimal
maintenance, maximum reuse, and compatibility across Passport, Other
Exam, Audit Leave and future HRMS extensions.





# Part 8 -- Future Roadmap, Design Principles \& Conclusion

## 8.1 Long-term Vision

The Floating Window is intended to become a universal layer shared by
every FCI HRMS workflow extension.

Instead of embedding exceptional routing logic into each `content.js`,
the workflow-specific script remains responsible for detecting the
normal business stage and performing its standard automation.

The floating window exists only to provide additional manual routing
choices whenever the dealing hand wishes to deviate from the recommended
path.

\---

## 8.2 Separation of Responsibilities

### content.js

Responsible for:

* Reading the request.
* Detecting workflow stage.
* Extracting request-specific data.
* Performing normal automation.
* Exposing routing helper APIs.

### floating\_window.js

Responsible only for:

* Displaying the floating panel.
* Showing optional routing actions.
* Calling helper APIs exposed by content.js.
* Never implementing workflow logic itself.

\---

## 8.3 Universal Alternative Actions

Every future extension should expose the same supplementary options:

1. **Re-examine**

   * Returns the request to the relevant assistant.
   * Standard remark: > Kindly re-examine the request.
2. **Return to Previous Level**

   * DO initiated requests → Manager (Admin.)
   * RO initiated requests → Request initiating official.

These actions should remain identical across all HRMS workflow
extensions.

\---

## 8.4 Integration Pattern

For each new extension:

1. Copy the generic floating window files.
2. Add a lightweight bridge in `content.js`.
3. Expose workflow helper functions.
4. Register metadata for the floating window.

No redesign of the floating window is required.

\---

## 8.5 Expected Benefits

* Minimal maintenance.
* Consistent user experience.
* Reusable architecture.
* Smaller workflow scripts.
* Easy future expansion.

\---

## 8.6 Design Principles

* Business logic belongs inside workflow scripts.
* UI belongs inside the floating window.
* Routing data remains the responsibility of `content.js`.
* Floating window should never duplicate routing rules.

\---

## 8.7 Future Possibilities

The architecture allows future additions such as:

* Request summary cards.
* Validation warnings.
* Routing history.
* Reviewer checklist.
* Draft remark templates.
* Extension diagnostics.

These can all be added without modifying workflow logic.

\---

# Conclusion

The proposed floating window is not a replacement for the existing
automation.

Instead, it is a reusable control layer that sits on top of every
workflow extension, preserving existing behaviour while providing
controlled manual alternatives whenever exceptional handling is
required.

This architecture maximises code reuse, minimises maintenance, and
provides a scalable foundation for all future FCI HRMS automation
extensions.

