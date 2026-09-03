# SQLite → Firestore migration runbook

This runbook is for the one-time MV household datastore migration. It does **not**
switch production reads/writes to Firestore. Production cutover is a later stage.

## Safety rules

1. Take and retain a byte-for-byte backup of the authoritative SQLite file before any apply run.
2. Run the migration command in dry-run mode first.
3. Do not continue unless source validation reports `sourceValid: true`.
4. Every active household member must resolve to a verified Firebase UID by email.
5. Legacy password hashes, salts and local session tokens are intentionally excluded.
6. A non-empty Firestore household is refused by default.
7. Do not use `--allow-replace` unless the existing Firestore target has been independently confirmed disposable.
8. Production must remain on SQLite until the later cutover stage verifies the migration marker and fingerprint.

## Dry-run

```bash
npm run migrate:firestore -- --source /absolute/path/to/mv_household.sqlite
```

Review all evidence:
- household version and schema version
- member roles and Firebase UID bindings
- row counts for every migrated collection
- transaction totals by type
- planned income/payment totals
- savings total
- every account stored balance vs independently reconstructed balance
- source SHA-256 dataset fingerprint
- warnings/errors

A dry-run performs no Firestore writes.

## Apply

Only after the dry-run evidence is accepted:

```bash
npm run migrate:firestore -- \
  --source /absolute/path/to/mv_household.sqlite \
  --apply \
  --confirm MIGRATE_SQLITE_TO_FIRESTORE
```

The migrator writes business/history records first, then creates `meta/state`
with `migrationState: verifying`. It independently reads Firestore back,
revalidates the dataset and compares the full canonical SHA-256 fingerprint.
Only an exact match is finalized as:

- `households/household-mv.migrationState = complete`
- `households/household-mv/meta/state.migrationState = complete`
- `households/household-mv/meta/migration.state = complete`
- source and target fingerprints equal

If validation or fingerprint comparison fails, the migration is not marked complete.

## Rollback before production cutover

Stage 6 does not change the production datastore, so the authoritative SQLite
database remains the rollback source. If a test/apply Firestore target is bad,
do not cut over production. Preserve the SQLite backup and remove/recreate the
Firestore target only after the failure has been investigated.

## Data intentionally preserved

- household version, fiscal lock and close timestamp
- household members and roles
- member UI preferences
- active and archived accounts
- active and archived categories
- all transactions and transaction splits
- refund/transfer/repayment/savings flags
- idempotency keys and tax-year metadata
- planned payments and planned incomes with actual linkages
- savings goals
- **all** audit rows, not only the latest 200

## Data intentionally not migrated

- legacy password hashes
- legacy password salts
- legacy local authentication sessions

Production authentication is Firebase verified identity only.
