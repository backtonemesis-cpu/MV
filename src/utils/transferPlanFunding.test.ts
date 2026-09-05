import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import {
  findLatestTransferPlanFundingBatch,
  getLatestTransferPlanFundingByDestination,
  getTransferPlanFundingBatches,
  isTransferPlanFundingTransaction,
} from './transferPlanFunding';

const transfer = (
  id: string,
  sourceAccountId: string,
  destinationAccountId: string,
  amountPence: number,
  date: string,
  description: string,
  metadata?: Record<string, any>,
  createdAt = `${date}T10:00:00.000Z`
): Transaction => ({
  id,
  date,
  description,
  amountPence,
  type: 'transfer',
  categoryId: 'cat-transfer',
  accountId: sourceAccountId,
  targetAccountId: destinationAccountId,
  payer: 'Marius',
  isTransfer: true,
  isRepayment: false,
  isSavings: false,
  isRefund: false,
  metadata,
  createdAt,
  createdBy: 'test',
});

describe('Transfer Plan funding history recognition', () => {
  it('groups a multi-source funding batch and preserves exact allocations', () => {
    const transactions = [
      transfer(
        'tx-a',
        'source-a',
        'destination',
        50_00,
        '2026-09-05',
        'Transfer Plan: Fund Current',
        {
          transferBatchId: 'batch-1',
          transferPlanMonth: '2026-09',
          allocationIndex: 0,
          allocationCount: 2,
        }
      ),
      transfer(
        'tx-b',
        'source-b',
        'destination',
        40_00,
        '2026-09-05',
        'Transfer Plan: Fund Current',
        {
          transferBatchId: 'batch-1',
          transferPlanMonth: '2026-09',
          allocationIndex: 1,
          allocationCount: 2,
        }
      ),
    ];

    const batches = getTransferPlanFundingBatches(transactions, '2026-09');

    expect(batches).toHaveLength(1);
    expect(batches[0].totalPence).toBe(90_00);
    expect(batches[0].sourceAccountIds).toEqual(['source-a', 'source-b']);
    expect(batches[0].allocations).toEqual([
      { sourceAccountId: 'source-a', amountPence: 50_00 },
      { sourceAccountId: 'source-b', amountPence: 40_00 },
    ]);
  });

  it('recognises legacy Transfer Plan funding by its historical description', () => {
    const legacy = transfer(
      'legacy-1',
      'source',
      'destination',
      75_00,
      '2026-09-04',
      'Transfer Plan: Fund Lloyds'
    );

    expect(isTransferPlanFundingTransaction(legacy)).toBe(true);
    expect(
      findLatestTransferPlanFundingBatch([legacy], 'destination', '2026-09')
        ?.totalPence
    ).toBe(75_00);
  });

  it('exposes funding-like untagged transfers only through the legacy fallback', () => {
    const legacy = transfer(
      'legacy-untagged',
      'source',
      'destination',
      80_00,
      '2026-09-04',
      'Fund Vesta current'
    );

    expect(isTransferPlanFundingTransaction(legacy)).toBe(false);
    expect(
      getLatestTransferPlanFundingByDestination([legacy], '2026-09').size
    ).toBe(0);

    const compatible = getLatestTransferPlanFundingByDestination(
      [legacy],
      '2026-09',
      true
    );

    expect(compatible.get('destination')?.kind).toBe('legacy_incoming');
    expect(compatible.get('destination')?.totalPence).toBe(80_00);
  });

  it('never treats an ordinary incoming transfer as Transfer Plan funding', () => {
    const ordinary = transfer(
      'ordinary-1',
      'source',
      'destination',
      50_00,
      '2026-09-04',
      'Move money to current account'
    );

    expect(isTransferPlanFundingTransaction(ordinary)).toBe(false);
    expect(getTransferPlanFundingBatches([ordinary], '2026-09')).toHaveLength(0);
    expect(
      getLatestTransferPlanFundingByDestination([ordinary], '2026-09', true).size
    ).toBe(0);
  });

  it('uses the explicit planning month instead of the transfer date when present', () => {
    const plannedForOctober = transfer(
      'october-plan',
      'source',
      'destination',
      60_00,
      '2026-09-30',
      'Custom description is allowed',
      {
        transferBatchId: 'october-batch',
        transferPlanMonth: '2026-10',
      }
    );

    expect(
      getTransferPlanFundingBatches([plannedForOctober], '2026-09')
    ).toHaveLength(0);
    expect(
      getTransferPlanFundingBatches([plannedForOctober], '2026-10')
    ).toHaveLength(1);
  });

  it('returns the latest funding batch for each destination account', () => {
    const older = transfer(
      'old',
      'source-a',
      'destination',
      20_00,
      '2026-09-03',
      'Transfer Plan: Fund Current',
      { transferBatchId: 'old-batch', transferPlanMonth: '2026-09' },
      '2026-09-03T10:00:00.000Z'
    );
    const newer = transfer(
      'new',
      'source-b',
      'destination',
      30_00,
      '2026-09-05',
      'Transfer Plan: Fund Current',
      { transferBatchId: 'new-batch', transferPlanMonth: '2026-09' },
      '2026-09-05T10:00:00.000Z'
    );

    const latest = getLatestTransferPlanFundingByDestination(
      [older, newer],
      '2026-09'
    );

    expect(latest.get('destination')?.batchKey).toBe('new-batch');
    expect(latest.get('destination')?.totalPence).toBe(30_00);
  });
});
