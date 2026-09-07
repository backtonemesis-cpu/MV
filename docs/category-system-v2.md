# Category implementation status

Base: main bd84a67934aa45d42da65b861490124d969b6334.
Branch: feat/category-system-v2. PR #128 is not the implementation base.

## Stage 1 foundation checkpoint

The V2 model, canonical UK registry, catalogue validator and isolated storage-boundary
primitive are implemented. These modules are not yet imported by the active app.
The existing V1 runtime remains active until integration and its regression gate pass.
This is a deliberate intermediate checkpoint, not a completed schema transition.

V2 uses immutable category/group IDs, semantic group scope, protected system roles,
separate month/category budgets and retained supersession lineage. Its clean-state
factory accepts household identity only. Its loader reads/writes only mv_local_state_v2
and requires a complete financial-validation callback before any initial write.
No legacy financial dataset is read or migrated. Unknown schemas fail closed.

The old local and dormant server registries remain V1 definitions at this checkpoint.
They must be retired or labelled non-authoritative during integration before sign-off.

Tests cover taxonomy identities, independent seeds, scope independent of group names,
system flags, duplicate IDs/names, archived name reservation, invalid group references,
merge cycles/scope, period budget structure, untouched V1 bytes, no partial seed writes
and rejection of corrupt/incompatible saved data.

Local full-suite execution is blocked by unavailable npm dependencies. Required CI
typecheck, existing and new tests, privacy guard and build must pass before advancing.
No financial mutation, merge, deployment or live verification has occurred.

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
