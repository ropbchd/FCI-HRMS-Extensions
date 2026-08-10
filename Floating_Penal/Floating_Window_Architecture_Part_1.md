# Floating Window Architecture -- Part 1

## Purpose

This document describes the proposed floating window architecture for
the FCI HRMS browser extensions.

The floating window is intended to act as a **supplementary control
layer**. It should not replace the existing `content.js` workflow logic.
Instead, it provides optional actions that can be invoked when needed
while allowing the normal automation to continue unchanged.

## Design Philosophy

-   Existing `content.js` remains the single source of truth.
-   Existing stage detection remains unchanged.
-   Existing routing logic remains unchanged.
-   Floating window only exposes additional actions.
-   Business logic stays inside `content.js`.
-   The floating window sends commands; `content.js` executes them.

## Benefits

-   Minimal changes to existing extensions.
-   Reusable across Passport, Other Exam, Audit Leave and future
    workflows.
-   Easier maintenance.
-   Consistent user experience.

## Proposed Buttons

1.  **Recommended Action**
    -   Display only.
    -   Shows the action inferred by `content.js`.
2.  **Re-examine**
    -   Sends the request back to the relevant assistant with the
        remark: `Kindly re-examine the request.`
3.  **Return to Previous Level**
    -   If initiated at a Divisional Office: Return to Manager (Admin.).
    -   If initiated at Regional Office: Return to the initiating
        official.

## Integration Strategy

A separate floating-window script should be injected alongside the
existing extension.

Communication should occur through lightweight custom events or a shared
sessionStorage command so that `content.js` performs the actual routing.

This architecture keeps all routing knowledge in one place and allows
the floating window to remain generic across extensions.
