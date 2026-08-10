# Floating Window Architecture -- Part 3

# Developer Implementation Guide

## Objective

This document defines the reusable implementation architecture for the
Floating Window Framework.

Unlike the previous parts, this document focuses on **how the framework
should be built**, not merely what it should do.

------------------------------------------------------------------------

# Proposed Folder Structure

    Extension
    │
    ├── manifest.json
    ├── content.js                 <-- Existing business logic
    ├── content_add_reviewer.js    <-- Existing Add Reviewer automation
    │
    ├── floating_window.js         <-- NEW
    ├── floating_window.css        <-- NEW
    └── icons/

The existing files continue to perform their current responsibilities.

Only two new files are introduced.

------------------------------------------------------------------------

# Responsibilities

## content.js

Remains the **single source of truth**.

Responsible for:

-   Stage detection
-   Reading HRMS page
-   Parsing Action History
-   Reading employee information
-   Deciding routing
-   Building remarks
-   Opening attachments
-   Clicking "Add Reviewer"

The floating window must **never duplicate this logic.**

------------------------------------------------------------------------

## floating_window.js

Responsible only for:

-   Creating the floating panel
-   Displaying the detected workflow status
-   Showing available buttons
-   Sending generic commands back to `content.js`

It must not contain:

-   Assistant names
-   Office mappings
-   Business rules
-   Routing logic
-   Stage logic

------------------------------------------------------------------------

## content_add_reviewer.js

No architectural changes.

It continues to:

-   Read sessionStorage
-   Fill Office
-   Fill Employee
-   Fill Remark
-   Scroll to Add button

Exactly as it already does.

------------------------------------------------------------------------

# Communication Architecture

    Review Page

            │
            ▼

    content.js
            │
            ├──────────────► floating_window.js
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
    content_add_reviewer.js

------------------------------------------------------------------------

# Generic Command API

The floating window should never know workflow details.

Instead it should emit only one of the following commands:

    recommended
    reexamine
    return_previous

`content.js` interprets these commands according to the current
workflow.

This allows every extension to reuse the same floating window.

------------------------------------------------------------------------

# Floating Window UI

Suggested layout

    +------------------------------------+
    |      FCI Workflow Assistant        |
    +------------------------------------+

    Current Request
    NOCPASS12345

    Recommended Action

    [ Send to Assistant ]

    Alternative Actions

    [ Re-examine ]

    [ Return to Previous Level ]

    Status

    Waiting for user...

No stage numbers should appear.

The interface should speak only in business language.

------------------------------------------------------------------------

# Generic Event Handler (Skeleton)

``` javascript
document.addEventListener("FW_COMMAND", function(e){

    switch(e.detail.command){

        case "recommended":
            // Existing workflow
            break;

        case "reexamine":
            // Existing workflow
            break;

        case "return_previous":
            // Existing workflow
            break;

    }

});
```

Only this listener needs to be added to each `content.js`.

The rest of the routing remains unchanged.

------------------------------------------------------------------------

# Minimal Patch Philosophy

Every future extension should require only:

1.  Inject floating window.

2.  Register three commands.

3.  Reuse existing routing functions.

No duplication of routing logic.

No rewriting of stage detection.

------------------------------------------------------------------------

# Coding Standards

The framework should always follow these rules:

-   Business logic lives only inside `content.js`.
-   Floating window is UI only.
-   Commands must remain generic.
-   sessionStorage continues to transport routing data.
-   Existing routing architecture must not be broken.
-   Existing workflow remains the default behaviour.
-   Floating window only provides additional user choices.

------------------------------------------------------------------------

# Long-term Benefits

Following this architecture means every future extension---Passport,
Other Exam, Audit Leave, Transfer, Benevolent Fund, Gratuity and
others---can share one common floating window implementation while
keeping each workflow's business logic isolated inside its own
`content.js`.

This significantly reduces maintenance effort, improves consistency
across extensions and makes future enhancements available to every
workflow with minimal additional code.
