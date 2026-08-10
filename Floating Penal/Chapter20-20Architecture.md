# FCI HRMS Floating Panel Framework

## Chapter 02 - Framework Architecture

### Purpose

Defines the overall architecture of the Floating Panel Framework.

## Core Components

### content.js

-   Detects requests
-   Determines stages
-   Generates remarks
-   Decides routing
-   Stores SessionStorage values
-   Executes commands

### Floating Panel

-   Displays available actions
-   Calls content.js commands
-   Contains no business logic

### content_add_reviewer.js

-   Reads SessionStorage
-   Fills Add Reviewer form
-   Stops before final submission

## Communication

``` text
content.js
   ↓
Floating Panel
   ↓
content.js Command
   ↓
content_add_reviewer.js
```

## Design Principles

1.  content.js is the single source of truth.
2.  Floating Panel never duplicates routing logic.
3.  Generic, reusable and patch-based.
4.  Existing automation remains intact.

## Workflow

1.  Detect request.
2.  Analyse stage.
3.  Show Floating Panel.
4.  User selects action.
5.  content.js executes it.
6.  Existing automation completes Add Reviewer.

## Summary

The Floating Panel is a reusable UI layer that complements existing
extensions without replacing their business logic.
