# Part 8 -- Future Roadmap, Design Principles & Conclusion

## 8.1 Long-term Vision

The Floating Window is intended to become a universal layer shared by
every FCI HRMS workflow extension.

Instead of embedding exceptional routing logic into each `content.js`,
the workflow-specific script remains responsible for detecting the
normal business stage and performing its standard automation.

The floating window exists only to provide additional manual routing
choices whenever the dealing hand wishes to deviate from the recommended
path.

------------------------------------------------------------------------

## 8.2 Separation of Responsibilities

### content.js

Responsible for:

-   Reading the request.
-   Detecting workflow stage.
-   Extracting request-specific data.
-   Performing normal automation.
-   Exposing routing helper APIs.

### floating_window.js

Responsible only for:

-   Displaying the floating panel.
-   Showing optional routing actions.
-   Calling helper APIs exposed by content.js.
-   Never implementing workflow logic itself.

------------------------------------------------------------------------

## 8.3 Universal Alternative Actions

Every future extension should expose the same supplementary options:

1.  **Re-examine**
    -   Returns the request to the relevant assistant.
    -   Standard remark: \> Kindly re-examine the request.
2.  **Return to Previous Level**
    -   DO initiated requests → Manager (Admin.)
    -   RO initiated requests → Request initiating official.

These actions should remain identical across all HRMS workflow
extensions.

------------------------------------------------------------------------

## 8.4 Integration Pattern

For each new extension:

1.  Copy the generic floating window files.
2.  Add a lightweight bridge in `content.js`.
3.  Expose workflow helper functions.
4.  Register metadata for the floating window.

No redesign of the floating window is required.

------------------------------------------------------------------------

## 8.5 Expected Benefits

-   Minimal maintenance.
-   Consistent user experience.
-   Reusable architecture.
-   Smaller workflow scripts.
-   Easy future expansion.

------------------------------------------------------------------------

## 8.6 Design Principles

-   Business logic belongs inside workflow scripts.
-   UI belongs inside the floating window.
-   Routing data remains the responsibility of `content.js`.
-   Floating window should never duplicate routing rules.

------------------------------------------------------------------------

## 8.7 Future Possibilities

The architecture allows future additions such as:

-   Request summary cards.
-   Validation warnings.
-   Routing history.
-   Reviewer checklist.
-   Draft remark templates.
-   Extension diagnostics.

These can all be added without modifying workflow logic.

------------------------------------------------------------------------

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
