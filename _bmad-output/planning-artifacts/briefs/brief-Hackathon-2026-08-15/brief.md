---
title: "Reconciliation Prototype Product Brief"
status: ready_for_review
created: 2026-08-15
updated: 2026-08-15
---

# Product Brief: Reconciliation Prototype

## Executive Summary

Build a polished Electron desktop prototype for daily trade reconciliation. It will demonstrate how a business user can select an as-of date, run a reconciliation using realistic mock broker and OT/MUREX data, understand exceptions, document them, and prepare broker follow-up—all in a modern, data-forward workspace.

The immediate purpose is a hackathon pitch. The prototype must convince Adhi first, then make business stakeholders feel that the current Excel/VBA process can become a credible product experience. SQLite preserves demo state while external integrations remain mocked. [ASSUMPTION] Stakeholders will judge success primarily through a two- to three-minute, end-to-end demo.

## Who This Serves

The first audience is Adhi, who is evaluating whether the experience is compelling enough to pitch. The pitch audience is internal business stakeholders who need confidence that the product can make daily reconciliation faster to navigate, clearer to act on, and easier to communicate.

## The Problem

Daily reconciliation is currently centered on Excel/VBA and manual follow-up. Users need to inspect trade differences, establish why a trade is unresolved, retain comments, and communicate with brokers. A spreadsheet result alone does not provide a coherent exception-resolution workflow or a clear view of today’s operational state.

## Success Criteria

- A demo user can complete the core flow—start a run, inspect an exception, save a comment, preview a broker email, and save a report—without dead ends.
- The grid shows counterparty, ISIN, buy/sell, amount, quantity, currency, settlement date, and other required trade fields.
- The post-run summary makes the reconciliation outcome and unresolved work immediately understandable.
- The prototype looks and behaves like a cohesive modern product, not a collection of mock screens.

## The Prototype Experience

1. **Dashboard and start.** The application lands on a dashboard with the latest reconciliation summary and a dominant **Start Reconciliation** action. Before the first run, it becomes an elegant empty state with the same action.
2. **Run and results.** The user chooses an as-of date, runs reconciliation against seeded mock data, and arrives at matched, unmatched, broker-missing, and OT/MUREX-missing records in filterable grids.
3. **Investigate and act.** The grid opens with priority columns; users can access every other trade-relevant field without leaving the screen. Selecting an unmatched trade opens a side detail panel with the full record, persistent comments, and a broker-email preview. Every unmatched record receives human review; no email is sent automatically.
4. **Summary and warning.** A compact post-run summary shows totals, matched records, unresolved records, and reconciliation rate. When the current unresolved rate differs materially from prior seeded runs, an amber, non-blocking warning explains the current rate and historical baseline. The prototype does not include a historical drill-down.

## Scope

### In scope

- Electron desktop UI with a dashboard, reconciliation start flow, results grids, trade-detail side panel, summary, and report-save interaction.
- Seeded mock broker and OT/MUREX data.
- SQLite persistence for reconciliation runs, comments, mock broker details, and seeded historical statistics.
- Mock broker email preview and report output flow.
- Lightweight, explainable anomaly warning based on historical unresolved-rate data.

### Out of scope

- Outlook, shared-folder, or real OT/MUREX integration.
- Migration of or parity validation against the existing VBA mapping scripts.
- Real email sending.
- Production authentication, scheduling, deployment, or multi-user collaboration.
- Historical analytics screens and advanced anomaly modelling.

## Future Direction

If the prototype proves compelling, the next phase replaces mocks with controlled enterprise adapters, ports the VBA mapping logic, and validates it against historical files. The architecture should keep those integrations behind clear boundaries so the pitch prototype can evolve without a UI rewrite.
