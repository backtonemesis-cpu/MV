import { describe, expect, it } from 'vitest';
import {
  assertCategorySchema,
  createCleanCategoryHousehold,
} from './categories/schema';
import type { TransferPlanFundingRecord } from './types';
import { normalizeTransferPlanFundingRecords } from './utils/transferPlanFundingPersistence';

function record(id = 'batch-1'): TransferPlanFundingRecord {
  return {
    id,
    schemaVersion: 1,
    month: '2026-09',
    destinationAccountId: 'dest',
    createdAt: '2026-09-12T12:00:00.000Z',
    createdBy: 'marius@local.invalid',
    destinationBalanceBeforePence: 0,
    expectedTransferTotalPence: 10_000,
    sourceLegs: [
      { transactionId: `tx-${id}`, sourceAccountId: 'source', amountPence: 10_000 },
    ],
    billAttributions: [
      {
        plannedPaymentId: 'rent',
        paymentNameSnapshot: 'Rent',
        paymentAmountPenceSnapshot: 10_000,
        attributedPence: 10_000,
        sourceShares: [
          { transactionId: `tx-${id}`, sourceAccountId: 'source', amountPence: 10_000 },
        ],
      },
    ],
  };
}

function cleanState() {
  return createCleanCategoryHousehold(
    {
      id: 'household-test',
      name: 'Test',
      members: [],
    },
    1
  );
}

describe('GA-TP-002 funding persistence compatibility', () => {
  it('initializes clean V2 households with an empty funding-record collection', () => {
    expect(cleanState().transferPlanFundingRecords).toEqual([]);
  });

  it('normalizes legacy households with no collection to an empty array without inference', () => {
    expect(normalizeTransferPlanFundingRecords(undefined)).toEqual([]);
  });

  it('normalizes a legacy-compatible V2 state at the schema boundary used by load/save/restore', () => {
    const state = cleanState();
    delete state.transferPlanFundingRecords;

    assertCategorySchema(state);

    expect(state.transferPlanFundingRecords).toEqual([]);
  });

  it('preserves a valid explicit funding record exactly by value', () => {
    const original = record();
    const normalized = normalizeTransferPlanFundingRecords([original]);

    expect(normalized).toEqual([original]);
    expect(normalized[0]).not.toBe(original);
  });

  it('rejects duplicate funding-record IDs', () => {
    expect(() => normalizeTransferPlanFundingRecords([record(), record()])).toThrow(
      "Transfer Plan funding record ID 'batch-1' is duplicated"
    );
  });

  it('rejects structurally corrupt persisted attribution instead of repairing it', () => {
    const corrupt = record();
    corrupt.billAttributions[0].sourceShares[0].amountPence = 9_999;

    expect(() => normalizeTransferPlanFundingRecords([corrupt])).toThrow(
      'do not match the attributed amount'
    );
  });

  it('rejects corrupt explicit attribution through the schema boundary before state use', () => {
    const state = cleanState();
    const corrupt = record();
    corrupt.billAttributions[0].sourceShares[0].amountPence = 9_999;
    state.transferPlanFundingRecords = [corrupt];

    expect(() => assertCategorySchema(state)).toThrow(
      'do not match the attributed amount'
    );
  });
});
