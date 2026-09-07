# Category implementation status

Base: main bd84a67934aa45d42da65b861490124d969b6334.
Branch: feat/category-system-v2. PR #128 is not the implementation base.

## Stages 1–2 integration checkpoint

The active browser runtime now uses mv_local_state_v2 and dataSchemaVersion 2.
V1 and legacy source-import backups are never consumed by this runtime. The canonical
registry is authoritative for blank V2 seeds; dormant server definitions are labelled
V1-only. Existing runtime financial calculations remain in localStore.

Manual bill/income/transaction categories are validated at the write boundary. Paid
and received records propagate the existing category exactly. Semantic eligibility is
bound to household group scope, including custom groups, rather than group names.
Split assignments are checked on create/edit. Missing Activity categories are explicit
invalid references. The Budget view reads period-specific budgets; editing remains
part of Stage 5. This minimal read adaptation was necessary when removing the old
category-level budget property.

Local validation: typecheck PASS, 348 tests in 47 files PASS, production build PASS.
The required Node 22 CI remains the merge gate (local runtime is Node 24).
Synthetic fixtures now provide explicit categories and canonical IDs. The obsolete
V1 source recovery assertion was replaced with a quarantine/no-recovery assertion.
No test was skipped. New write-boundary tests cover missing/cross-scope categories,
exact paid/received propagation, invalid split categories/totals, and schema rejection.
Existing transfer/payment/refund/repayment/reconciliation tests remain green.

Stage 3 category/group administration, Stages 4–6 and production verification remain
pending. No merge, deployment or live financial mutation has occurred.

## Preserved forensic findings from PR #128

The retired importer assigned broad Fixed / Fixed Bills classification to planned
bills and associated Activity expenses. Payment recording propagated that relationship.
Prepare Next Month retained classification and copiedFromId lineage, allowing the
same classification defect to propagate to subsequent months. Deterministic evidence
covered rent, electricity, council tax, broadband, maintenance paid, known subscriptions,
phones, salary, Universal Credit and Child Benefit. Variable Household remained ambiguous;
bank fees and maintenance received had no dedicated modern taxonomy destinations.

PR #128 remains open and unmerged. Its raw boot-time migration will not be adopted.
Close it as superseded only after the full replacement is verified in production.

## Remaining required stages

1. Finish foundation integration: authoritative V2 runtime and retire V1 registry paths.
2. Manual required categories; semantic eligibility; remove housing/salary/General
   fallbacks; validate split assignments at the storage boundary.
3. Settings category/group administration, stable-ID lifecycle and reference-safe delete.
4. Atomic merge and narrow bulk recategorisation with reference preview and audit.
5. Monthly budget storage operations and existing Budget view integration.
6. Complete financial/category backup validation, rollback and round-trip tests.
7. Cross-app regression, review, CI, merge, deployment and desktop/iPhone verification.

Recurrence extension (one-off/monthly/quarterly/half-yearly/yearly/custom) and refund
source-link UI remain separate follow-ups. Payees, tags, automation and investments
remain out of scope. The Transfer Plan visual redesign remains frozen.

Category-phase completion does not imply global-audit completion.

## Stage 3 checkpoint

Added src/categories/management.ts, management.test.ts and CategorySettings.tsx;
SettingsView/App wire the management panel to current household data. Commands are
optimistically versioned and atomic, audit each mutation, reject protected categories,
reserve archived names and count all current references before hard delete. A runtime
financial-identity assertion prevents classification operations changing money fields.
Local typecheck, 354 tests in 48 files and build passed. Visual verification is pending.

Publishing integration commit 6819cfd was blocked by automatic approval review, which
cited unverified sensitive-code disclosure to the explicitly requested GitHub repository.
No alternate publishing path was attempted after that rejection. PR #129 still contains
the isolated foundation commit only. Later local commits remain unpublished.
