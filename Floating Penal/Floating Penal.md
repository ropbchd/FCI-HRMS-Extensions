# FCI HRMS Floating Panel Framework

## Developer Architecture \& Integration Specification

# Chapter 01 - Introduction \& Project Overview

This chapter introduces the purpose, scope, vision and philosophy of the
Floating Panel Framework.

## 1\. Introduction

The Floating Panel Framework is a reusable interface layer designed to
supplement existing HRMS browser extensions without replacing their
business logic.

## 2\. Purpose

* Master technical specification.
* Integration guide.
* Standard architecture.
* Starter document for future ChatGPT sessions.

## 3\. Background

Existing extensions detect requests, analyse workflow stages, determine
routing, generate remarks and automate Add Reviewer. The Floating Panel
complements this workflow by providing optional user-controlled actions.

## 4\. Problem Statement

Existing automation follows the normal workflow only. Exceptional
routing requires manual effort and duplicated code across extensions.

## 5\. Vision

The Floating Panel enhances automation while keeping `content.js` as the
single owner of business logic.

## 6\. Objectives

Provide a common UI, minimise code duplication, preserve routing logic
and support future extensions.

## 7\. Scope

Included: UI, command dispatch, integration, SessionStorage interface.
Excluded: stage detection, routing logic, remark generation and business
rules.

## 8\. Design Philosophy

`content.js` owns business logic; the Floating Panel owns user
interaction.

## 9\. Benefits

Reduced maintenance, reusable architecture, consistent UX and easier
future development.

## 10\. Long-Term Vision

A universal framework shared by all HRMS workflow extensions.





# FCI HRMS Floating Panel Framework

## Chapter 02 - Framework Architecture

### Purpose

Defines the overall architecture of the Floating Panel Framework.

## Core Components

### content.js

* Detects requests
* Determines stages
* Generates remarks
* Decides routing
* Stores SessionStorage values
* Executes commands

### Floating Panel

* Displays available actions
* Calls content.js commands
* Contains no business logic

### content\_add\_reviewer.js

* Reads SessionStorage
* Fills Add Reviewer form
* Stops before final submission

## Communication

``` text
content.js
   ↓
Floating Panel
   ↓
content.js Command
   ↓
content\\\_add\\\_reviewer.js
```

## Design Principles

1. content.js is the single source of truth.
2. Floating Panel never duplicates routing logic.
3. Generic, reusable and patch-based.
4. Existing automation remains intact.

## Workflow

1. Detect request.
2. Analyse stage.
3. Show Floating Panel.
4. User selects action.
5. content.js executes it.
6. Existing automation completes Add Reviewer.

## Summary

The Floating Panel is a reusable UI layer that complements existing
extensions without replacing their business logic.





# Chapter 4 — Floating Panel Architecture

## Objective

This chapter defines the architectural relationship between `content.js` and the Floating Panel.

## Guiding Principle

`content.js` remains the single source of truth.

The Floating Panel never contains workflow-specific routing logic. It is a lightweight UI layer that invokes actions already exposed by `content.js`.

## Responsibilities

### content.js

* Detect current business stage.
* Read workflow data.
* Decide routing.
* Store routing metadata in sessionStorage.
* Expose reusable action functions.

### Floating Panel

* Display contextual buttons.
* Call action APIs exposed by `content.js`.
* Never duplicate routing logic.

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

* Request ID
* Employee details
* Office
* Current reviewer
* Current routing stage (optional)
* Recommended action availability

## Benefits

* One routing engine.
* One reusable floating panel.
* Minimal maintenance.
* Easy integration with future extensions.





# Chapter 5 — Integration Contract for `content.js`

## Purpose

This chapter defines the **mandatory integration contract** that every `content.js` must satisfy in order to become compatible with the universal Floating Panel.

The objective is to ensure that every extension—whether it handles NOC for Passport, NOC for Other Exam, Leave Audit, or any future workflow—can share the same Floating Panel without rewriting the panel itself.

\---

# Design Principle

The Floating Panel **must never understand business logic.**

Instead:

* `content.js` understands the workflow.
* `content.js` understands routing.
* `content.js` understands stage detection.
* The Floating Panel only requests actions.

\---

# Responsibilities of content.js

Every compatible `content.js` shall:

1. Detect the current workflow stage.
2. Parse all workflow-specific information.
3. Determine routing decisions.
4. Store reusable routing context.
5. Expose a common public API.
6. Execute commands requested by the Floating Panel.

\---

# Standard Context

Every extension should make the following information available (either directly or through `sessionStorage`):

## Employee Information

* Employee Name
* Employee Number
* Designation
* Cadre
* Office

## Request Information

* Request ID
* Request Type
* Initiating Office
* Current Reviewer

## Routing Information

* Recommended Assistant
* Recommended Office
* Recommended Remark
* Previous Level Details
* Re-examination Target

\---

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

\---

# Why a Public API?

Without a common API:

* every extension would need a different floating panel,
* future maintenance would become difficult,
* business logic would become duplicated.

A common API keeps all workflow intelligence inside `content.js`.

\---

# Session Storage Guidelines

The panel should never attempt to infer routing by itself.

Instead, `content.js` should prepare and store all routing information that may be required by:

* normal routing,
* re-examination,
* return to previous level.

Where an existing extension already stores these values, no change is required.

Where an extension does not currently store enough information, only the missing values should be added.

\---

# Backward Compatibility

Existing extensions should require only minimal modifications.

The objective is **not** to rewrite working code.

Instead:

* retain existing stage detection,
* retain existing routing logic,
* expose the API,
* store any additional context required by the Floating Panel.

This allows the Floating Panel to be dropped into existing extensions with minimal changes while remaining compatible with future extensions.



