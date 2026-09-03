# MV initial secure architecture

This scaffold deliberately fixes the unsafe assumptions in the first external draft. It is a foundation, not a finished finance application.

## Authoritative storage

Firestore is the shared system of record. Browser local storage is not used as authoritative household financial storage.

Paths:

- `users/{uid}` — authenticated user profile and household membership state.
- `households/mv-primary` — the single initial household.
- `households/mv-primary/records/{recordId}` — versioned financial records.
- `households/mv-primary/audit/{auditId}` — append-only audit events.

## Identity and membership

The only self-bootstrap Owner identity is the verified Firebase Auth email `backtonemesis@gmail.com`.

Any other verified authenticated email can create only a strict Pending profile. Firestore rules prevent a new user from choosing `approved`, `editor`, `viewer`, or `owner` for themselves.

Only the approved Owner can move another user from Pending to Editor/Viewer or to Removed.

Pending and Removed users cannot read household financial data.

## Authorization

Firestore Security Rules enforce membership on data reads/writes. UI checks are convenience only and are not security boundaries.

- Owner: read/write household data and manage membership.
- Editor: read/write household financial data.
- Viewer: read household data only.
- Pending/Removed: no household financial data.

## Money representation

All financial calculations use safe integer pence. Floating-point currency values are rejected by core validation.

The current monthly formula is:

`actual income + refunds/credits - fixed bills - gross non-fixed spending`

Internal transfers, savings transfers and credit-card repayments are balance movements and do not create new household income/spending.

## Concurrent editing

Every financial record contains a positive integer `revision`.

Updates run inside a Firestore transaction and require the caller's `expectedRevision` to match the currently stored revision. A stale client receives a conflict error rather than silently overwriting newer data.

Firestore rules independently require each update to increment revision by exactly one.

## Audit history

Financial create/update/delete operations and membership changes create an audit document in the same batch/transaction as the business write. Audit documents can be created by authorised editors/owner but cannot be updated or deleted by clients.

Before production release, add Firebase Emulator security-rule tests to prove each role boundary against the actual rules file.

## Known next work

This branch is intentionally limited to the secure foundation. It does not yet implement the full MV dashboard, accounts, savings, Transfer Plan, export/import or reconciliation UI. Those should be built after this access/data model is reviewed and accepted.
