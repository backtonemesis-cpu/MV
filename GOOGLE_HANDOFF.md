# MV — Google Development Handoff

## Project status

This is a brand-new private repository created specifically for **MV**. Start from scratch. Do not import, copy, or refactor the Penny codebase unless Marius later explicitly requests a specific migration artifact.

## Product purpose

MV is a shared household finance application for **Marius and Vesta**. It must support simultaneous use by both people against one authoritative household dataset.

The product should be simple for day-to-day money management while remaining technically safe, traceable, and recoverable.

## Identity and household access

Initial identities:

- Marius: `backtonemesis@gmail.com`
- Vesta: `vestajuskaite@gmail.com`

Required household model:

1. Marius is the initial **Household Owner/Admin**.
2. Any other authenticated account begins as **Pending**.
3. Pending users must receive **no household financial data**.
4. Owner/Admin can approve a pending user as:
   - Household Editor
   - View only
   - Reject/Remove
5. Only Owner/Admin can approve users, change roles, or remove household members.
6. Household Editor can add/edit/delete permitted financial data.
7. View-only can read household data but cannot alter it.
8. Removed users must lose household-data access immediately.
9. A household role must never grant source-code, repository, deployment, hosting, publishing, or application-development privileges.
10. Authorization must be enforced server-side on every protected read and write. Never trust a browser-supplied email or role as authority.

## Shared financial data

The data model should be capable of representing at least:

- Months / budgeting periods
- Income
- Expenses / transactions
- Accounts
- Savings
- Transfer planning
- Categories
- People / ownership / payer attribution
- Settings
- Audit/history records

The exact UX and schema may evolve during development, but one shared household dataset is mandatory.

## Financial integrity rules

- Use exact currency handling. Prefer integer minor units (for GBP, pence) or a decimal-safe money representation.
- Internal transfers must not be double-counted as income or spending.
- Card repayments must not be counted as spending again where underlying merchant transactions are already counted.
- Refunds/credits are not salary/income. They should restore available money while keeping gross spending visible where appropriate.
- Savings transfers should remain traceable but should not be counted as ordinary spending.
- Preserve payer/person/account attribution on financial records.
- Do not silently infer unclear financial classifications; surface them for confirmation.

## Concurrency and history

MV is intended for two people to use at the same time.

Required protections:

- Server-side revision/version checking or an equivalent concurrency mechanism.
- A stale client must not silently overwrite a newer save.
- Conflicts should be rejected or safely reconciled and clearly shown to the user.
- Maintain an append-only or otherwise tamper-resistant audit/history record for membership/role changes and meaningful financial changes.
- Audit entries should include actor identity, timestamp, affected entity, action, and enough before/after context to understand what changed.

## Security expectations

- Authentication is required for household data.
- Household authorization must be enforced at the backend/database layer as well as in the UI.
- Do not expose one household's data to another user or household.
- Do not place service-role keys or privileged secrets in browser-delivered code.
- Use environment variables/secrets for backend credentials.
- Apply least-privilege database policies.
- Include security-focused automated tests for Pending, Editor, View-only, Removed and Owner/Admin behavior.

## UX expectations

- Mobile-first, with iPhone as a priority.
- Fully usable on desktop as well.
- Simple, clear financial entry flows.
- Avoid browser controls that are awkward on mobile when a contained accessible control is more appropriate.
- Do not redesign purely for novelty; functionality and clarity take priority.
- Show clear loading, save, conflict and error states.
- Never imply data is saved until the backend confirms it.

## Migration from existing app

Do **not** migrate production data automatically during initial development.

When Marius later supplies an approved export/backup:

1. Validate the source file.
2. Create a recoverable backup before any import.
3. Reconcile totals and row counts before and after import.
4. Copy/import data; do not destroy the source artifact.
5. Make imports idempotent so repeating an import cannot duplicate records silently.
6. Record migration/import activity in audit history.
7. Do not declare migration complete until reconciliation passes.

## Recommended development approach

Technology choice is open, but the implementation must support:

- modern web front end
- authenticated users
- server-side/shared database
- row/household-level authorization
- versioned writes or optimistic concurrency
- automated tests
- low-cost/free-tier deployment suitable for a two-person private household app

A React/Vite-style front end plus a managed backend such as Supabase/Firebase is acceptable, but Google may choose another suitable stack if it satisfies the security and cost requirements.

## Repository workflow

- Work in feature branches.
- Keep `main` deployable.
- Use pull requests for substantive changes.
- Do not commit secrets.
- Add automated test/build checks before production deployment.
- Document significant architectural decisions.

## Minimum acceptance tests before first production release

1. Marius can authenticate and is recognised as Owner/Admin.
2. Unknown authenticated user becomes Pending only.
3. Pending user cannot read household financial data.
4. Marius can approve a user as Editor or View only.
5. Editor can make permitted financial changes.
6. View-only cannot write.
7. Removed user loses access.
8. Non-owner cannot promote themselves or alter membership roles.
9. One household/user cannot read another household's data.
10. Two active clients cannot silently overwrite each other's newer changes.
11. Currency calculations preserve pennies exactly.
12. Export/backup and restore paths are tested.
13. Mobile/iPhone layout is usable.
14. Desktop layout is usable.
15. Production build and deployment tests pass.
16. Transfer Plan exact deficit & surplus integrity (distinguishes Paid/Unpaid from Transfer Plan inclusion, computes exact integer-pence requirements without floating-point drift, returns £0.00 for funded accounts, and treats internal transfers as non-spending/non-income).

## What not to do

- Do not make browser localStorage the authoritative household database.
- Do not hard-code privileged credentials into the front end.
- Do not expose household data to Pending users.
- Do not grant household members repository/development access through application roles.
- Do not import old Penny code by default.
- Do not claim a migration or release is complete without testing and reconciliation.

## First task for the next developer

Propose the concrete architecture and free-tier hosting/database/authentication stack, including how household-level authorization and concurrency will be enforced. Then scaffold the application and automated test setup on a feature branch before building financial features.
