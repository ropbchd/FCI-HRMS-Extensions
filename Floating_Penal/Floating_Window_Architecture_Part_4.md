# Floating Window Architecture -- Part 4

# Production Implementation & Integration Guide

## Purpose

This document serves as the final implementation specification for
integrating the Floating Window Framework into existing and future FCI
HRMS browser extensions.

The objective is to create a **single reusable UI component** that works
across all workflow-specific extensions while requiring only minimal
changes to each `content.js`.

------------------------------------------------------------------------

# Overall Architecture

                        Review Page
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
     content_add_reviewer.js
             │
             ▼
     Add Reviewer Form

The floating window **never performs routing itself**. It only requests
an action from `content.js`.

------------------------------------------------------------------------

# Production Files

Every extension should eventually contain:

    manifest.json

    content.js

    content_add_reviewer.js

    floating_window.js

    floating_window.css

No additional workflow-specific floating window files should ever be
required.

------------------------------------------------------------------------

# Responsibilities

## content.js

Must expose three logical actions:

-   Execute Recommended Action
-   Execute Re-examine
-   Execute Return to Previous Level

These actions internally reuse the extension's existing routing code.

No duplicate routing code should be introduced.

------------------------------------------------------------------------

## floating_window.js

Responsibilities:

-   Build floating panel
-   Detect whether the panel already exists
-   Display request number
-   Display extension name
-   Display recommended action text
-   Display the three buttons
-   Dispatch generic commands
-   Show current status

Nothing else.

------------------------------------------------------------------------

## floating_window.css

Responsible only for presentation:

-   Position
-   Colours
-   Typography
-   Responsive layout
-   Minimise visual interference with HRMS

------------------------------------------------------------------------

# User Interface Specification

    --------------------------------------------------

    FCI Workflow Assistant

    Request

    NOCPASS12345

    Recommended Action

    [ Send to Assistant ]

    Alternative Actions

    [ Re-examine ]

    [ Return to Previous Level ]

    Status

    Ready

    --------------------------------------------------

The wording should always be business-oriented.

Never expose:

-   Stage numbers
-   Internal variables
-   SessionStorage keys
-   Assistant IDs
-   Routing rules

------------------------------------------------------------------------

# Recommended Integration Pattern

Inside `content.js`

    analyseWorkflow()

    ↓

    prepareRoutingData()

    ↓

    publishRecommendedAction()

    ↓

    showFloatingWindow()

If the user does nothing,

normal workflow continues.

If the user presses an alternative button,

the corresponding routing function executes instead.

------------------------------------------------------------------------

# Minimal Patch Required

Each existing extension only needs to implement:

1.  Include `floating_window.js`.

2.  Include `floating_window.css`.

3.  Register the command listener.

4.  Map three commands to existing routing functions.

Everything else remains unchanged.

------------------------------------------------------------------------

# Extension-Specific Responsibilities

The floating window should never know:

-   which assistant
-   which office
-   which manager
-   what remark
-   what stage
-   how routing works

Those remain entirely inside the workflow-specific extension.

------------------------------------------------------------------------

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

------------------------------------------------------------------------

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

------------------------------------------------------------------------

# Future Enhancements

Possible additions include:

-   Dark mode.
-   Minimise / expand panel.
-   Keyboard shortcuts.
-   Confirmation dialog before dispatch.
-   User-configurable button visibility.
-   Workflow progress indicator.
-   Diagnostic mode for debugging.
-   Logging console for developer builds.

These enhancements should be implemented entirely within the floating
window and must not require modifications to business logic.

------------------------------------------------------------------------

# Starter Prompt for Future Development

Use the following when beginning work on a new extension:

> Implement the Floating Window Framework using the architecture defined
> in Parts 1--4. Preserve the existing `content.js` as the single source
> of truth. The floating window must remain workflow-agnostic, display
> the recommended action and two standard alternatives ("Re-examine" and
> "Return to Previous Level"), and communicate with `content.js` through
> generic commands. All routing decisions, remarks, office mappings and
> assistant selection must remain inside `content.js`. Existing Add
> Reviewer automation (`content_add_reviewer.js`) should continue
> unchanged.

------------------------------------------------------------------------

# Conclusion

The Floating Window Framework is intended to become the common user
interaction layer for every FCI HRMS browser extension. By separating
presentation from business logic, the framework ensures consistency,
maintainability and scalability while preserving the proven routing
architecture already implemented within each workflow-specific
`content.js`.
