# MV Household Finance / Penny — Transfer Plan Bill Funding Attribution Design

**Status:** DESIGN COMPLETE / IMPLEMENTATION NOT YET STARTED  
**Risk class:** R4 financial evidence and reversal design  
**Issue:** `GA-TP-002` — per-bill Undo Funding attribution  
**Baseline used for design:** `d0c67c7bd122286811ab5880d7e8347a9b8aad33`  
**Evidence level:** current source + current automated/deployment evidence; no physical-device claim

---

## 1. Problem statement

Current Transfer Plan funding evidence is destination-account/batch based. A funding transfer stores a batch ID, month, destination account, source account allocation(s) and transfer amounts, but it does **not** store which PlannedPayment/bill received which part of the transfer.

That is sufficient for current card/batch Undo Funding, but insufficient for safe per-bill Undo Funding. Inferring bill attribution later by amount, display position, proportional allocation, bill name, due date alone, or current balance would invent financial history.

The design therefore makes bill attribution **explicit at funding time** and never reconstructs it later.

---

## 2. Governing principles

1. **Money movement and bill attribution are separate facts.**
   - Transfer transactions remain authoritative evidence that cash moved between accounts.
   - A funding-attribution record states why portions of that batch were assigned to selected bills.

2. **Attribution is immutable historical evidence.**
   - It is created atomically with the funding batch.
   - It records exact integer pence and stable IDs.
   - Later bill edits must not rewrite historical attribution.

3. **Undo is an exact linked reversal, never an inference.**
   - A per-bill undo can reverse only explicit active source shares recorded for that bill.
   - No proportional, positional, name-based or amount-matching reconstruction is allowed.

4. **Existing account balance is not a transfer.**
   - Existing-balance coverage must never be represented as fake funding or become undoable funding.

5. **Legacy evidence is not upgraded by guesswork.**
   - Existing transaction-only funding batches remain legacy batch-level evidence.
   - Bill-level Undo Funding is unavailable for those batches unless explicit attribution was recorded originally.

6. **Funding remains separate from payment.**
   - Undo Funding must never remove or alter payment evidence.
   - Undo Payment must never alter funding evidence.

---

## 3. New first-class evidence record

Add a persisted funding-attribution entity. Recommended shape:

```ts
interface TransferPlanFundingRecord {
  id: string; // same logical identity as transferBatchId
  schemaVersion: 1;
  month: string;
  destinationAccountId: string;
  createdAt: string;
  createdBy: string;

  destinationBalanceBeforePence: number;
  expectedTransferTotalPence: number;

  sourceLegs: Array<{
    transactionId: string;
    sourceAccountId: string;
    amountPence: number;
  }>;

  billAttributions: Array<{
    plannedPaymentId: string;
    paymentNameSnapshot: string;
    paymentAmountPenceSnapshot: number;
    paymentDueDateSnapshot?: string;
    attributedPence: number;
    sourceShares: Array<{
      transactionId: string;
      sourceAccountId: string;
      amountPence: number;
    }>;
  }>;

  accountDeficitRecovery?: {
    amountPence: number;
    sourceShares: Array<{
      transactionId: string;
      sourceAccountId: string;
      amountPence: number;
    }>;
  };
}
```

Recommended household persistence field:

```ts
transferPlanFundingRecords: TransferPlanFundingRecord[];
```

Old saved households/backups that do not contain the field normalize it to `[]` without fabricating records for legacy batches.

---

## 4. Why source-level bill shares are mandatory

A record containing only:

```ts
{ plannedPaymentId, attributedPence }
```

is insufficient when a funding batch uses multiple source accounts.

Example:
- Source A → destination: £80
- Source B → destination: £70
- Rent transfer-attributed amount: £50
- Council Tax transfer-attributed amount: £100

A safe per-bill undo must know **which source account receives each reversed penny**. Therefore each bill attribution must contain exact source shares linked to the original source transfer transaction.

The attribution model is consequently a matrix:

**source transfer legs × funding purposes (bill or account-deficit recovery)**.

Every row and column must reconcile exactly.

---

## 5. Attribution algorithm at Record Funding time

The attribution algorithm is deterministic, but the persisted result — not the algorithm — is the future source of truth.

### 5.1 Snapshot authoritative inputs

Within the same version-checked mutation that records funding:
- destination account and exact pre-transfer balance;
- selected **unpaid** PlannedPayments for that destination/month;
- exact source allocations confirmed by the user;
- exact transfer-required total.

The mutation recomputes and validates these from current state before writing anything.

### 5.2 Stable bill ordering

For attribution only, order selected unpaid bills by:
1. due date ascending; bills without due date last;
2. stable PlannedPayment ID ascending as tie-breaker.

Do not use display position as evidence.

### 5.3 Existing-balance coverage

Let:

```ts
existingCoveragePool = Math.max(0, destinationBalanceBeforePence)
```

Apply that pool to ordered bills, allowing partial coverage of a bill.

For each bill:

```ts
existingCoverage = min(existingCoveragePool, bill.amountPence)
transferNeed = bill.amountPence - existingCoverage
existingCoveragePool -= existingCoverage
```

Only `transferNeed` becomes bill funding attribution.

Existing-balance coverage is deliberately **not persisted as undoable transfer funding**. It may be retained as a calculation snapshot for diagnostics, but it is never a funding transaction and has no Undo Funding action.

### 5.4 Negative destination balance / deficit recovery

Current Transfer Plan truth is:

```ts
transferRequired = max(0, totalSelectedUnpaidBills - destinationBalanceBeforePence)
```

When the destination balance is negative, transfer-required exceeds total bill value. The excess is not attributable to any bill.

Persist it as:

```ts
accountDeficitRecoveryPence = Math.max(0, -destinationBalanceBeforePence)
```

This amount is account-level funding evidence and can be reversed only by batch/card-level Undo Funding, not by a bill-level undo.

### 5.5 Allocate source contributions

Consume confirmed source allocations in their confirmed order against funding purposes in this order:
1. account-deficit recovery, when present;
2. ordered bill transfer needs.

A source contribution may span multiple purposes; a bill may span multiple sources. Persist every resulting source share explicitly.

The user does not need to manually map sources to bills for the first implementation. If a future requirement adds per-bill source mapping, the same record shape supports it.

---

## 6. Mandatory record invariants

A new attributed funding record is valid only when all conditions hold:

1. all pence values are safe integers and non-negative;
2. `expectedTransferTotalPence > 0`;
3. source transaction IDs are unique within the record;
4. every source leg is a real Transfer Plan transfer to the same destination and batch;
5. every current bill attribution references a bill that was selected, unpaid, in the same month and destination account **at creation time**;
6. each bill attribution is `> 0` and `<= paymentAmountPenceSnapshot`;
7. bill IDs are unique within the record;
8. each bill's `sum(sourceShares.amountPence) === attributedPence`;
9. deficit recovery's source-share sum equals its amount;
10. for each source leg, the sum of all bill/deficit shares referencing that transaction equals the source leg amount;
11. `sum(sourceLegs.amountPence) === expectedTransferTotalPence`;
12. `sum(billAttributions.attributedPence) + deficitRecovery.amountPence === expectedTransferTotalPence`;
13. the record and source transfer transactions are persisted atomically in one household-version mutation;
14. if any invariant fails, nothing is written.

---

## 7. Reversal model

### 7.1 Do not mutate historical attribution

The original funding record and original transfer transactions remain historical evidence.

For **new attributed batches**, Undo Funding should use append-only linked reversal transfer transactions rather than partially editing/deleting original transfer legs.

Recommended reversal metadata:

```ts
metadata: {
  transferPlanFundingReversal: true,
  transferPlanFundingRecordId: fundingRecord.id,
  transferPlanPaymentId?: plannedPaymentId, // omitted for deficit/batch-only share
  originalFundingTransactionId: sourceLeg.transactionId,
  reversalScope: 'bill' | 'batch'
}
```

`originalTransactionId` may additionally point to the original funding transfer leg if compatible with existing generic transaction semantics.

A reversal transaction is still an internal transfer: it is not income, spending, savings or payment.

### 7.2 Per-bill Undo Funding

For a selected bill:
1. locate its most recent funding record with active unreversed bill attribution;
2. calculate active unreversed source shares from persisted attribution minus already-linked reversal transactions;
3. require exact source transaction linkage and current household version;
4. create one reverse transfer leg per active source share:
   - source = funding destination account;
   - destination = original funding source account;
   - amount = exact remaining attributed source share;
5. decrease the original destination balance and increase each original source balance by exactly those amounts;
6. do **not** change PlannedPayment payment status, actual payment evidence or inclusion state;
7. reject the action if the attribution is missing, ambiguous, corrupt or already fully reversed.

The UI label should state the exact reversible amount, e.g. **Undo funding £50.00**.

### 7.3 Multiple batches for one bill

A bill may receive explicit funding from more than one batch over time.

The bill-level action reverses **the most recent active attributed batch only**. Repeating the action can then expose the next older active attribution. This prevents one click from reversing unrelated historical batches.

### 7.4 Card/batch Undo Funding

For a new attributed batch, card-level Undo Funding reverses every remaining active share in the latest batch:
- all bill source shares not already reversed;
- all remaining account-deficit recovery shares.

If some bill shares were previously undone, batch undo reverses only the remainder. Double reversal is prohibited.

### 7.5 Paid bills

Funding and payment remain independent.

A paid bill may still have reversible funding evidence. Undo Funding may reverse that funding without undoing the payment. Confirmation must state that the payment remains recorded and the destination account may become underfunded/negative as a truthful consequence.

---

## 8. Active funding derivation

Original attribution is immutable. Active funding is derived from:

```text
original explicit attribution
minus
exact linked reversal transactions
```

Never overwrite the original record to mark a share as removed.

For each bill:

```ts
activeAttributedPence = originalAttributedPence - reversedAttributedPence
```

For each source share, reversal must never exceed the original share.

This provides idempotency and an auditable history.

---

## 9. Lifecycle / UI rules

Account-card lifecycle remains based first on **current cash sufficiency**, preserving existing behaviour:
- Needs Funding
- Funded by Transfer
- Covered by Existing Balance
- Paid / Complete

Attribution adds evidence; it does not redefine payment.

### Bill row

For new attributed funding:
- show active explicit transfer-funded amount when `> 0`;
- show bill-level `Undo funding £X.XX` only when exact active attribution exists;
- after undo, current account shortfall is recalculated normally.

### Covered by Existing Balance

No funding record is created and no Undo Funding control is shown.

### Legacy funding batch

Legacy transaction-only batches:
- remain visible as funding evidence;
- retain safe existing card/batch Undo Funding behaviour;
- do **not** expose per-bill Undo Funding;
- may show compact copy such as `Older funding record — bill-level undo unavailable` when useful.

### Corrupt/mismatched attributed evidence

Fail closed:
- no guessed per-bill reversal;
- no silent fallback to amount/order inference;
- show a review/error state with batch identity.

---

## 10. Persistence and migration

### New households / new saves

Persist `transferPlanFundingRecords` as a normal part of `HouseholdData` and therefore normal local backup/restore.

### Existing `mv_local_state_v2`

On load, absent `transferPlanFundingRecords` normalizes to `[]`.

Do not infer records from historical transfer descriptions, amounts, source order, account balance or selected bills.

### Legacy funding transactions

Continue recognising them through the existing legacy/batch parser for display and existing full-batch undo compatibility.

### Backup restore

Validation must ensure new records are internally reconciled with their original funding transactions when those transactions are present. A deleted/renamed current PlannedPayment must not destroy historical evidence because the record contains payment snapshots.

Old backups without the collection remain valid and restore as legacy/no-attribution data.

---

## 11. Required implementation boundaries

The first implementation must **not**:
- infer attribution for existing batches;
- alter planned bill amounts/status to make attribution fit;
- count funding or funding reversals as income/spending;
- use account names instead of stable account IDs;
- overload `Transaction.plannedPaymentId` for funding transfers because that field currently participates in actual-payment evidence semantics;
- silently mutate original funding transaction amounts during a partial bill undo;
- allow reversal beyond the exact active source share;
- make deficit-recovery funding undoable from an individual bill;
- merge funding and payment undo workflows.

---

## 12. Required automated test matrix

### Attribution creation
- zero destination balance; one source; one bill;
- positive balance partially covers first bill;
- positive balance covers one full bill and part of next;
- negative destination balance creates explicit deficit-recovery attribution;
- one source → multiple bills;
- multiple sources → one bill;
- multiple sources → multiple bills;
- same-value bills remain distinct by stable PlannedPayment IDs;
- due-date ties resolve deterministically by stable ID;
- exact row/column pence reconciliation.

### Bill undo
- bill undo reverses exact source shares and exact balances;
- multi-source bill undo returns exact amounts to each source account;
- bill undo never changes payment status/evidence;
- paid bill funding can be undone while payment remains recorded;
- double bill undo is rejected;
- latest active attribution is reversed first when a bill has multiple batches;
- bill undo cannot reverse deficit-recovery funding;
- same-name accounts remain distinct by ID.

### Batch undo
- batch undo after no partial undo reverses the whole active batch exactly;
- batch undo after one bill undo reverses only remaining active shares;
- no source/destination balance drift;
- no duplicate reversal.

### Legacy safety
- legacy batch exposes no bill-level undo;
- legacy full-batch undo continues to pass existing contract;
- old household with no attribution collection loads safely;
- old backup restores safely.

### Corruption / concurrency
- record/source-transaction mismatch fails closed;
- missing source transaction fails closed for new attributed reversal;
- stale household version aborts atomically;
- reversal amount greater than original share is rejected;
- no partial write on any validation failure.

### Classification / reconciliation
- original funding and reversal remain internal transfers;
- neither affects income/spending totals;
- Activity shows traceable original + reversal evidence;
- Transfer Plan account totals reconcile after each operation;
- backup/restore preserves records and reversal linkage exactly.

---

## 13. Acceptance criteria for resolving GA-TP-002

`GA-TP-002` may move from `BLOCKED` only after the implementation proves all of the following:

1. every **new** funding batch stores explicit immutable bill/source attribution;
2. existing balance and negative-balance deficit are modelled separately and correctly;
3. per-bill undo reverses only exact active explicit attribution;
4. multi-source reversal returns exact pence to exact stable source account IDs;
5. payment evidence is untouched;
6. partial bill undo followed by batch undo reconciles exactly;
7. legacy batches are never guessed and remain safe;
8. persistence/backup/restore support the new evidence;
9. all financial, storage, Activity, Transfer Plan and regression suites pass;
10. branch CI, exact-main CI and Pages deployment pass;
11. the master audit ledger is reconciled to the resulting deployed SHA.

---

## 14. Design decision summary

**Approved engineering direction for implementation:**

- introduce a first-class immutable `TransferPlanFundingRecord`;
- record an exact source-to-purpose attribution matrix atomically with each new funding batch;
- model negative-balance recovery as account-level, not bill-level, funding;
- preserve existing-balance coverage as non-transfer/non-undoable;
- use append-only exact linked reversal transfers for partial/new attributed Undo Funding;
- retain legacy transaction-only batches without fabricated bill attribution;
- derive active attribution from original evidence minus exact reversals;
- keep funding and payment fully independent.

This is the minimum model that supports per-bill Undo Funding without inventing financial history or compromising exact reversibility.
