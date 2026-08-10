# Chapter 5 — Integration Contract for `content.js`

## Purpose

This chapter defines the **mandatory integration contract** that every `content.js` must satisfy in order to become compatible with the universal Floating Panel.

The objective is to ensure that every extension—whether it handles NOC for Passport, NOC for Other Exam, Leave Audit, or any future workflow—can share the same Floating Panel without rewriting the panel itself.

---

# Design Principle

The Floating Panel **must never understand business logic.**

Instead:

- `content.js` understands the workflow.
- `content.js` understands routing.
- `content.js` understands stage detection.
- The Floating Panel only requests actions.

---

# Responsibilities of content.js

Every compatible `content.js` shall:

1. Detect the current workflow stage.
2. Parse all workflow-specific information.
3. Determine routing decisions.
4. Store reusable routing context.
5. Expose a common public API.
6. Execute commands requested by the Floating Panel.

---

# Standard Context

Every extension should make the following information available (either directly or through `sessionStorage`):

## Employee Information

- Employee Name
- Employee Number
- Designation
- Cadre
- Office

## Request Information

- Request ID
- Request Type
- Initiating Office
- Current Reviewer

## Routing Information

- Recommended Assistant
- Recommended Office
- Recommended Remark
- Previous Level Details
- Re-examination Target

---

# Public API

Every extension should expose a common interface:

```javascript
window.FCIAssistant = {
    getContext(),
    sendRecommended(),
    sendForReExamination(),
    returnToPreviousLevel()
};
```

The Floating Panel should **only** call these methods.

---

# Why a Public API?

Without a common API:

- every extension would need a different floating panel,
- future maintenance would become difficult,
- business logic would become duplicated.

A common API keeps all workflow intelligence inside `content.js`.

---

# Session Storage Guidelines

The panel should never attempt to infer routing by itself.

Instead, `content.js` should prepare and store all routing information that may be required by:

- normal routing,
- re-examination,
- return to previous level.

Where an existing extension already stores these values, no change is required.

Where an extension does not currently store enough information, only the missing values should be added.

---

# Backward Compatibility

Existing extensions should require only minimal modifications.

The objective is **not** to rewrite working code.

Instead:

- retain existing stage detection,
- retain existing routing logic,
- expose the API,
- store any additional context required by the Floating Panel.

This allows the Floating Panel to be dropped into existing extensions with minimal changes while remaining compatible with future extensions.
