# Floating Window Architecture -- Part 2

# Workflow & Integration Architecture

## Core Principle

The floating window is **not** responsible for making workflow
decisions.

Instead:

-   `content.js` continues to detect the current business stage.
-   `content.js` continues to determine the correct routing.
-   The floating window only provides a user interface for optional
    actions.

------------------------------------------------------------------------

# Separation of Responsibilities

## content.js

Responsible for:

-   Reading request data.
-   Parsing action history.
-   Detecting business stage.
-   Determining routing.
-   Preparing routing data.
-   Executing routing.

## Floating Window

Responsible for:

-   Displaying workflow status.
-   Showing optional buttons.
-   Sending user commands.
-   Never containing workflow-specific routing logic.

------------------------------------------------------------------------

# Communication Model

    User
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

------------------------------------------------------------------------

# Proposed Commands

The floating window should send only generic commands such as:

-   recommended
-   reexamine
-   return_previous

The command may be passed using:

-   sessionStorage
-   CustomEvent
-   window.postMessage

`content.js` interprets the command and performs the appropriate action.

------------------------------------------------------------------------

# Why This Architecture?

Advantages include:

-   One source of business logic.
-   Reusable floating window.
-   Minimal modification to existing extensions.
-   Easier debugging.
-   Consistent behaviour across all request types.

------------------------------------------------------------------------

# Integration Steps

1.  Existing extension loads normally.
2.  content.js analyses the request.
3.  Floating window is injected.
4.  User may ignore the window.
5.  Normal automation proceeds unchanged.
6.  If an optional button is pressed, the command is passed to
    content.js.
7.  content.js performs the routing using its existing mechanisms.

------------------------------------------------------------------------

# Future Scalability

Every future workflow (Passport, Other Exam, Audit Leave, Benevolent
Fund, etc.) can reuse the same floating window.

Only the workflow-specific content.js understands:

-   assistants
-   managers
-   remarks
-   routing rules
-   office mappings

The floating window remains completely generic.
