# Part 7 -- Implementation Guide & Patch Architecture

## Objective

This document describes how the Floating Window should be integrated
into existing and future FCI HRMS browser extensions while keeping
workflow-specific logic inside `content.js`.

## Recommended File Structure

``` text
manifest.json
content.js
content_add_reviewer.js
floating_window.js
floating_window.css
floating_window_bridge.js
```

## Responsibilities

### content.js

-   Detect workflow stage.
-   Parse request details.
-   Store routing data in sessionStorage.
-   Expose helper/API functions:
    -   `routeRecommended()`
    -   `routeReExamine()`
    -   `routeReturnPrevious()`
    -   `getWorkflowContext()`

### floating_window.js

-   Create and manage the floating UI.
-   Display:
    -   Recommended Action
    -   Re-examine
    -   Return to Previous Level
-   Invoke helper APIs exposed by `content.js`.
-   Never duplicate business rules.

### content_add_reviewer.js

-   Generic form filler.
-   Reads sessionStorage only.
-   Fills Office, Employee and Reviewer Remarks.
-   Does not decide routing.

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
content_add_reviewer.js
      │
      ▼
Reviewer form auto-filled
```

## Integration Steps

1.  Add floating window files to the extension.
2.  Inject the floating panel after workflow detection.
3.  Register workflow metadata.
4.  Expose helper functions from `content.js`.
5.  Keep routing logic unchanged.
6.  Let the floating window call the helper APIs.

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

-   DO initiated request → Manager (Admin.)
-   RO initiated request → Request Initiating Official

The routing decision remains inside `content.js`.

## Testing Checklist

-   Recommended action still works.
-   Re-examine routes correctly.
-   Return Previous routes correctly.
-   Add Reviewer form fills correctly.
-   Reviewer Remarks populate correctly.
-   Existing workflow remains unaffected.

## Common Mistakes

-   Duplicating routing logic inside the floating window.
-   Reading workflow-specific fields directly from the UI.
-   Hard-coding employee mappings in the floating window.
-   Modifying existing business stages unnecessarily.

## Migration Guide

For each new workflow:

1.  Copy the generic floating window files.
2.  Add workflow bridge functions.
3.  Register workflow metadata.
4.  Reuse the same floating UI.

No redesign should be required.

## Summary

The floating window should remain a reusable UI layer. All workflow
intelligence continues to reside inside `content.js`, ensuring minimal
maintenance, maximum reuse, and compatibility across Passport, Other
Exam, Audit Leave and future HRMS extensions.
