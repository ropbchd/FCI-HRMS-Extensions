# Chapter 4 — Floating Panel Architecture

## Objective
This chapter defines the architectural relationship between `content.js` and the Floating Panel.

## Guiding Principle
`content.js` remains the single source of truth.

The Floating Panel never contains workflow-specific routing logic. It is a lightweight UI layer that invokes actions already exposed by `content.js`.

## Responsibilities

### content.js
- Detect current business stage.
- Read workflow data.
- Decide routing.
- Store routing metadata in sessionStorage.
- Expose reusable action functions.

### Floating Panel
- Display contextual buttons.
- Call action APIs exposed by `content.js`.
- Never duplicate routing logic.

## Suggested Public API

```javascript
window.FCIAssistant = {
  sendRecommended(),
  sendForReExamination(),
  returnToPreviousLevel(),
  getContext()
};
```

## Required Context
The panel should obtain from content.js:
- Request ID
- Employee details
- Office
- Current reviewer
- Current routing stage (optional)
- Recommended action availability

## Benefits
- One routing engine.
- One reusable floating panel.
- Minimal maintenance.
- Easy integration with future extensions.
