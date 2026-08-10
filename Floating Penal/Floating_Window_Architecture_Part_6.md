# Floating Window Architecture -- Part 6

# Complete Development Roadmap & Framework Governance

## Purpose

This final part consolidates the architectural decisions made throughout
Parts 1--5 and establishes a governance model for the Floating Window
Framework. Its purpose is to ensure that all present and future FCI HRMS
browser extensions evolve under a common architecture, reducing
duplication, simplifying maintenance and improving consistency.

------------------------------------------------------------------------

# Vision Statement

The Floating Window Framework is **not an automation engine**.

It is a **workflow control interface** that sits on top of
workflow-specific automation.

Every workflow continues to implement its own business logic, while the
framework provides a common and consistent user interaction layer.

------------------------------------------------------------------------

# Architectural Layers

    +--------------------------------------------------+
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
    |        content_add_reviewer.js (Shared)          |
    |  (Auto-fill Office, Employee, Remarks, Routing)  |
    +--------------------------------------------------+
                         │
                         ▼
                    HRMS Add Reviewer

Each layer has a clearly defined responsibility and should not duplicate
the responsibilities of another layer.

------------------------------------------------------------------------

# Governance Principles

The following rules should guide future development:

1.  Business logic belongs only in `content.js`.
2.  The floating window must remain workflow-agnostic.
3.  Routing data continues to be passed through existing mechanisms
    (e.g. `sessionStorage`).
4.  Existing automation should never be rewritten solely to accommodate
    the floating window.
5.  New workflow extensions should integrate with the framework instead
    of creating custom floating panels.

------------------------------------------------------------------------

# Standard User Actions

Every workflow should expose the same three conceptual actions:

-   **Recommended Action**
    -   Executes the normal workflow inferred by `content.js`.
-   **Re-examine**
    -   Sends the request back to the appropriate assistant with the
        standard remark: `Kindly re-examine the request.`
-   **Return to Previous Level**
    -   Returns the request to the previous administrative level
        according to the workflow's existing routing rules.

This consistency reduces the learning curve across all extensions.

------------------------------------------------------------------------

# Migration Strategy

When introducing the framework into an existing extension:

1.  Keep the current `content.js` unchanged as far as possible.
2.  Add the floating window scripts.
3.  Register the generic command listener.
4.  Map the three generic commands to existing routing functions.
5.  Verify that the Add Reviewer automation behaves exactly as before.

------------------------------------------------------------------------

# Versioning Guidelines

Suggested version structure:

-   Framework Version
    -   Floating Window
    -   Shared APIs
    -   Generic UI
-   Workflow Version
    -   Passport
    -   Other Exam
    -   Audit Leave
    -   Transfer
    -   Gratuity
    -   Benevolent Fund

This separation allows framework improvements without forcing changes to
workflow logic.

------------------------------------------------------------------------

# Future Enhancements

Potential future features include:

-   Configurable button visibility.
-   User preferences.
-   Keyboard shortcuts.
-   Compact/minimised mode.
-   Diagnostic logging panel.
-   Visual workflow timeline.
-   Confirmation prompts before routing.
-   Theme customisation.

These enhancements should be implemented within the framework and should
not require workflow-specific changes.

------------------------------------------------------------------------

# Recommended Development Workflow

1.  Design the workflow-specific business rules.
2.  Implement or update `content.js`.
3.  Reuse the shared `content_add_reviewer.js` where applicable.
4.  Integrate the Floating Window Framework.
5.  Test the three standard user actions.
6.  Validate the complete routing cycle.
7.  Release.

------------------------------------------------------------------------

# Final Notes

The architecture documented in Parts 1--6 is intended to establish a
long-term foundation for FCI HRMS browser extensions.

By maintaining a strict separation between:

-   user interface,
-   workflow logic,
-   routing,
-   and form automation,

the framework becomes easier to understand, extend and maintain.

The result is a scalable ecosystem in which every new workflow can share
a common interaction model while preserving its own business rules and
routing requirements.

------------------------------------------------------------------------

# End of Documentation Series

Parts 1--6 together provide:

-   Architectural vision.
-   Design philosophy.
-   Integration strategy.
-   Developer implementation guide.
-   Production reference.
-   Governance and long-term roadmap.

They are intended to serve both as: 1. A design reference for future
development. 2. A comprehensive starting prompt for any future
conversation or implementation effort involving the Floating Window
Framework.
