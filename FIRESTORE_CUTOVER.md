# MV durable Firestore cutover

## Status

MV is not production-ready while household finance data is authoritative in local SQLite on Cloud Run.

The production startup guard intentionally refuses Cloud Run + SQLite. Do not remove that guard until the Firestore cutover gates below pass.

The existing AI Studio configuration identifies a named Firestore database:

`ai-studio-mv-02fb52df-6e5f-458e-bc1e-b1fdc07a8db7`

That named database must remain locked down from browser access. It is not, however, approved as MV's authoritative production database because Firebase Admin's named-database `getFirestore(..., databaseId)` overload is currently Public Preview and Firebase documentation says not to use it in production.

MV authoritative production data must use the stable **`(default)` Firestore database** unless and until Firebase documents named-database Admin access as production-supported. If the project does not yet have a `(default)` database, it must be created/configured in Firebase/Google Cloud before production cutover.

The browser uses Firebase for authentication only. Direct browser Firestore reads/writes are denied. Household data access remains behind the MV server API and server-side authorization.

## Non-negotiable invariants

The Firestore implementation must preserve the current MV API semantics and the established financial rules rather than reverting the newer UI or data model.

- Money is stored as integer pence.
- Planned and actual financial state remain distinct.
- Refunds/credits remain separate from salary/income and do not erase gross spending.
- Internal transfers, savings transfers and credit-card repayments are not household income/spending.
- Reconciliation uses the reconciled balance plus only movements after the reconciliation point.
- Transfer Plan funds selected upcoming obligations and must not double-use source money.
- Marius (`backtonemesis@gmail.com`) is the sole Household Owner/Admin identity.
- New verified users start Pending and receive no household financial data.
- Editor may perform permitted financial writes; View-only cannot mutate.
- Membership/roles never grant repository, deployment or Firebase administration access.
- Every mutation must preserve optimistic concurrency protection and an auditable actor identity.
- Backup/restore must never restore or replace Owner/member authority.

## Server-side Firestore model

Keep the current HTTP API so the React UI does not need a wholesale rewrite.

Recommended document layout under `households/household-mv`:

- `meta/state` — household name, dataset version, schema version, updated timestamp.
- `members/{firebaseUid}` — verified email, display name, household role/status, approval metadata, last access.
- `preferences/{firebaseUid}` — theme/accent only; never household finance authority.
- `accounts/{accountId}` — account/reconciliation fields.
- `categories/{categoryId}` — category definition and budget metadata.
- `transactions/{transactionId}` — transaction, linkage, idempotency, audit metadata.
- `transactions/{transactionId}/splits/{splitId}` — split rows when present.
- `plannedPayments/{paymentId}` — planned bill plus actual linkage fields.
- `plannedIncomes/{incomeId}` — expected/actual income and linkage fields.
- `savingsGoals/{goalId}` — savings goal fields.
- `audit/{auditId}` — append-only mutation/member audit records.

Do not store local password hashes or MV session tokens in Firestore. Firebase Auth is the identity provider.

## Production database selection

Production server code must use the stable Firebase Admin default-database API:

`getFirestore(app)`

Repository code must fail closed if `MV_FIRESTORE_DATABASE_ID` is set to anything other than `(default)` while named-database Admin access remains preview-only.

The existing AI Studio named database can be retained for legacy/staging investigation, but direct client rules must remain deny-all and it must not silently become the production household system of record.

## Concurrency and atomic writes

The current dataset-level `expectedVersion` contract must remain authoritative during cutover.

Every financial mutation should run in a Firestore transaction that:

1. Reads `meta/state`.
2. Rejects the request with HTTP 409 if `expectedVersion` does not match the stored dataset version.
3. Reads any records needed for validation/linkage/balance calculation.
4. Applies the business mutation.
5. Appends the audit event in the same atomic transaction/batch where possible.
6. Increments the dataset version exactly once.
7. Returns the new version to the client.

Idempotency keys must remain unique for transaction creation/import operations so retries cannot duplicate money movements.

## Reconciliation

For each account:

`current = reconciliation anchor (or starting balance) + actual post-anchor inflows - actual post-anchor outflows`

A reconciled bank balance must never have pre-reconciliation transactions added again.

The Firestore implementation may cache calculated current balance on the account document only if the write transaction keeps it consistent with the authoritative movement records. Recalculation from authoritative records must remain possible.

## Migration from SQLite

Do not silently seed production with sample data.

Migration must be explicit and evidence-preserving:

1. Freeze financial writes for the migration window.
2. Export the current authoritative SQLite household financial data using a migration-only export that excludes local authentication/session secrets.
3. Preserve stable entity IDs and relationship/linkage IDs.
4. Import to a non-production Firestore test namespace/environment first.
5. Recalculate and compare:
   - account balances and reconciliation anchors;
   - monthly actual income;
   - refunds/credits;
   - fixed bills and gross other spending;
   - household available surplus;
   - planned payment/income actual linkages;
   - savings totals;
   - Transfer Plan inputs/requirements;
   - dataset version and schema compatibility.
6. Verify Marius Owner and Pending/Editor/View-only boundaries with real Firebase-authenticated test users.
7. Perform simultaneous-edit conflict tests.
8. Only then import to the production `(default)` Firestore database and switch the server backend.

Membership/Owner authority must be established from verified Firebase identities and must not be imported from a financial backup.

## Cutover PR sequence

Use separate reviewable PRs rather than one untestable replacement:

1. **Client boundary** — Firebase browser is Auth-only; direct Firestore access denied. Completed.
2. **Production database selection** — stable `(default)` Firestore only; named database rejected for authoritative production use while the Admin API is preview. This PR.
3. **Firestore server store + emulator tests** — implement typed persistence methods and role/version transactions without changing production backend.
4. **Read parity** — populate Firestore test fixtures and prove `/api/household` output matches SQLite fixture output for the same data.
5. **Mutation parity** — transactions, reconciliation, planned/actual linkage, month import, savings, backup/restore and membership operations pass the same behavioral tests against Firestore.
6. **Migration tooling** — explicit SQLite → Firestore migration with dry-run validation and no sample-data fallback.
7. **Production cutover** — set `MV_DATA_BACKEND=firestore`, require Firebase Admin/Firestore readiness, remove the Cloud Run SQLite refusal only for the completed Firestore path, deploy a new Cloud Run revision and verify it Ready.
8. **Post-cutover validation** — Marius/Vesta shared-data verification, role tests, concurrent-edit tests, backup/restore verification and totals comparison.

## Required external Firebase / Google Cloud configuration

Repository code alone cannot complete these controls:

- Google sign-in must be enabled in Firebase Authentication.
- The deployed MV domain must be an authorized Firebase Auth domain.
- The Cloud Run service account must have the minimum required access to verify Firebase Auth tokens and access Firestore through Application Default Credentials.
- A production `(default)` Firestore database must exist before server cutover.
- The existing named AI Studio Firestore database should have the fail-closed client rules from this repository deployed to it.
- When `(default)` is created, add it to the Firebase CLI rules configuration and deploy the same fail-closed browser rules there before production data is written.
- Production data migration must be deliberately executed and verified; it must never be inferred from development fixtures.

Do not mark MV production-ready until every cutover gate above is proven.
