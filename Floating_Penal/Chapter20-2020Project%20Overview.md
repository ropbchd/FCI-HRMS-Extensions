# FCI HRMS Floating Panel Framework

## Developer Architecture & Integration Specification

# Chapter 01 - Introduction & Project Overview

This chapter introduces the purpose, scope, vision and philosophy of the
Floating Panel Framework.

## 1. Introduction

The Floating Panel Framework is a reusable interface layer designed to
supplement existing HRMS browser extensions without replacing their
business logic.

## 2. Purpose

-   Master technical specification.
-   Integration guide.
-   Standard architecture.
-   Starter document for future ChatGPT sessions.

## 3. Background

Existing extensions detect requests, analyse workflow stages, determine
routing, generate remarks and automate Add Reviewer. The Floating Panel
complements this workflow by providing optional user-controlled actions.

## 4. Problem Statement

Existing automation follows the normal workflow only. Exceptional
routing requires manual effort and duplicated code across extensions.

## 5. Vision

The Floating Panel enhances automation while keeping `content.js` as the
single owner of business logic.

## 6. Objectives

Provide a common UI, minimise code duplication, preserve routing logic
and support future extensions.

## 7. Scope

Included: UI, command dispatch, integration, SessionStorage interface.
Excluded: stage detection, routing logic, remark generation and business
rules.

## 8. Design Philosophy

`content.js` owns business logic; the Floating Panel owns user
interaction.

## 9. Benefits

Reduced maintenance, reusable architecture, consistent UX and easier
future development.

## 10. Long-Term Vision

A universal framework shared by all HRMS workflow extensions.
