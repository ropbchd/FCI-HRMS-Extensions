# Floating Window Architecture -- Part 5

# Production Code Reference & Reusable Framework

## Objective

This document defines the implementation standards for the reusable
Floating Window Framework. It complements Parts 1--4 by describing the
production code layout and the reusable APIs that every workflow
extension should implement.

------------------------------------------------------------------------

# Guiding Principles

-   `content.js` remains the single source of truth.
-   `content_add_reviewer.js` remains the only Add Reviewer automation.
-   `floating_window.js` contains UI only.
-   The floating window never stores workflow-specific routing data.
-   All workflow-specific data remains inside `content.js`.

------------------------------------------------------------------------

# Production Components

## floating_window.js

Responsibilities:

-   Create the floating panel.
-   Display request information.
-   Display the recommended action supplied by `content.js`.
-   Display two universal alternatives:
    -   Re-examine
    -   Return to Previous Level
-   Send generic commands back to `content.js`.
-   Display progress/status messages.

------------------------------------------------------------------------

## floating_window.css

Defines:

-   Panel position.
-   Compact layout.
-   Theme colours.
-   Button styling.
-   Collapsible behaviour (future enhancement).
-   Responsive sizing.

------------------------------------------------------------------------

# Generic Command Contract

The floating window should emit only the following commands:

    recommended
    reexamine
    return_previous

Each workflow-specific `content.js` maps these commands to its own
routing functions.

------------------------------------------------------------------------

# Suggested Dispatcher

``` javascript
document.addEventListener("FW_COMMAND", (e) => {
    switch (e.detail.command) {
        case "recommended":
            executeRecommendedAction();
            break;

        case "reexamine":
            executeReExamine();
            break;

        case "return_previous":
            executeReturnPrevious();
            break;
    }
});
```

The dispatcher is generic and reusable across every extension.

------------------------------------------------------------------------

# Recommended Public API

Each `content.js` should expose (internally) functions equivalent to:

-   `executeRecommendedAction()`
-   `executeReExamine()`
-   `executeReturnPrevious()`

Internally, these functions should reuse the existing routing
implementation instead of duplicating logic.

------------------------------------------------------------------------

# Passport Workflow Mapping

Recommended: - Execute the normal routing already detected by
`content.js`.

Re-examine: - Route to the relevant assistant. - Use the remark: "Kindly
re-examine the request."

Return to Previous Level: - If initiated at Divisional Office → Manager
(Admin.). - If initiated at Regional Office → Initiating official.

------------------------------------------------------------------------

# Reuse Strategy

For every future extension:

1.  Copy `floating_window.js`.
2.  Copy `floating_window.css`.
3.  Register the generic dispatcher.
4.  Implement the three command handlers by calling existing routing
    functions.

No additional floating-window customisation should normally be required.

------------------------------------------------------------------------

# Quality Checklist

Before releasing an extension, verify:

-   Existing automation is unchanged.
-   Recommended action still follows existing workflow.
-   Universal actions work correctly.
-   No duplicate routing logic has been introduced.
-   UI remains workflow-independent.
-   Session storage usage remains compatible with existing code.

------------------------------------------------------------------------

# Long-term Vision

The floating window becomes a shared framework across all FCI HRMS
workflow extensions. Future improvements---such as better UI, keyboard
shortcuts, diagnostics or accessibility---can be made once inside the
framework and automatically benefit every extension without altering
business logic.
