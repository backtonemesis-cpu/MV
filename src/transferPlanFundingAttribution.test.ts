import { describe, expect, it } from 'vitest';
import type { PlannedPayment, TransferPlanFundingRecord } from './types';
import {
  buildTransferPlanFundingRecord,
  validateTransferPlanFundingRecord,
} from './utils/transferPlanFundingAttribution';

function payment(
  id: string,
  amountPence: number,
  dueDate?: string
): PlannedPayment {
  return {
    id,
    name: id,
    amountPence,
    month: '2026-09',
    responsiblePerson: 'Marius',
    accountId: 'dest',
    dueDate,
    categoryId: 'cat-test',
    status: 'unpaid',
    includeInTransferPlan: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'marius@local.invalid',
  };
}

const base = {
  id: 'batch-1',
  month: '2026-09',
  destinationAccountId: 'dest',
  createdAt: '2026-09-12T12:00:00.000Z',
  createdBy: 'marius@local.invalid',
};

describe('GA-TP-002 Transfer Plan funding attribution', () => {
  it('attributes a zero-balance one-source transfer exactly to one bill', () => {
    const record = buildTransferPlanFundingRecord({
      ...base,
      destinationBalanceBeforePence: 0,
      expectedTransferTotalPence: 10_000,
      sourceLegs: [
        { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 10_000 },
      ],
      selectedUnpaidPayments: [payment('rent', 10_000, '2026-09-05')],
    });

    expect(record.billAttributions).toEqual([
      expect.objectContaining({
        plannedPaymentId: 'rent',
        attributedPence: 10_000,
        sourceShares: [
          { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 10_000 },
        ],
      }),
    ]);
    expect(record.accountDeficitRecovery).toBeUndefined();
  });

  it('keeps existing balance non-transfer and attributes only the remaining bill need', () => {
    const record = buildTransferPlanFundingRecord({
      ...base,
      destinationBalanceBeforePence: 5_000,
      expectedTransferTotalPence: 15_000,
      sourceLegs: [
        { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 15_000 },
      ],
      selectedUnpaidPayments: [
        payment('rent', 10_000, '2026-09-05'),
        payment('council-tax', 10_000, '2026-09-10'),
      ],
    });

    expect(record.billAttributions.map((item) => [item.plannedPaymentId, item.attributedPence])).toEqual([
      ['rent', 5_000],
      ['council-tax', 10_000],
    ]);
    expect(record.expectedTransferTotalPence).toBe(15_000);
  });

  it('separates negative-balance recovery from bill funding', () => {
    const record = buildTransferPlanFundingRecord({
      ...base,
      destinationBalanceBeforePence: -4_000,
      expectedTransferTotalPence: 14_000,
      sourceLegs: [
        { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 14_000 },
      ],
      selectedUnpaidPayments: [payment('rent', 10_000, '2026-09-05')],
    });

    expect(record.accountDeficitRecovery).toEqual({
      amountPence: 4_000,
      sourceShares: [
        { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 4_000 },
      ],
    });
    expect(record.billAttributions[0].attributedPence).toBe(10_000);
    expect(record.billAttributions[0].sourceShares).toEqual([
      { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 10_000 },
    ]);
  });

  it('builds an exact multi-source x multi-purpose matrix', () => {
    const record = buildTransferPlanFundingRecord({
      ...base,
      destinationBalanceBeforePence: -2_000,
      expectedTransferTotalPence: 17_000,
      sourceLegs: [
        { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 8_000 },
        { transactionId: 'tx-b', sourceAccountId: 'source-b', amountPence: 9_000 },
      ],
      selectedUnpaidPayments: [
        payment('rent', 5_000, '2026-09-05'),
        payment('council-tax', 10_000, '2026-09-10'),
      ],
    });

    expect(record.accountDeficitRecovery?.sourceShares).toEqual([
      { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 2_000 },
    ]);
    expect(record.billAttributions[0].sourceShares).toEqual([
      { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 5_000 },
    ]);
    expect(record.billAttributions[1].sourceShares).toEqual([
      { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 1_000 },
      { transactionId: 'tx-b', sourceAccountId: 'source-b', amountPence: 9_000 },
    ]);

    validateTransferPlanFundingRecord(record);
  });

  it('keeps same-value bills distinct and uses stable ID as the due-date tie breaker', () => {
    const record = buildTransferPlanFundingRecord({
      ...base,
      destinationBalanceBeforePence: 0,
      expectedTransferTotalPence: 20_000,
      sourceLegs: [
        { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 20_000 },
      ],
      selectedUnpaidPayments: [
        payment('bill-z', 10_000, '2026-09-05'),
        payment('bill-a', 10_000, '2026-09-05'),
      ],
    });

    expect(record.billAttributions.map((item) => item.plannedPaymentId)).toEqual([
      'bill-a',
      'bill-z',
    ]);
  });

  it('rejects a funding total that does not equal the exact current requirement', () => {
    expect(() =>
      buildTransferPlanFundingRecord({
        ...base,
        destinationBalanceBeforePence: 5_000,
        expectedTransferTotalPence: 16_000,
        sourceLegs: [
          { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 16_000 },
        ],
        selectedUnpaidPayments: [
          payment('rent', 10_000, '2026-09-05'),
          payment('council-tax', 10_000, '2026-09-10'),
        ],
      })
    ).toThrow('does not match the exact selected-bill funding requirement');
  });

  it('rejects ineligible or cross-account bill attribution', () => {
    const wrongAccount = { ...payment('rent', 10_000), accountId: 'other-account' };
    expect(() =>
      buildTransferPlanFundingRecord({
        ...base,
        destinationBalanceBeforePence: 0,
        expectedTransferTotalPence: 10_000,
        sourceLegs: [
          { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 10_000 },
        ],
        selectedUnpaidPayments: [wrongAccount],
      })
    ).toThrow('same month and destination account');
  });

  it('fails closed when a persisted source share no longer reconciles to its source leg', () => {
    const valid = buildTransferPlanFundingRecord({
      ...base,
      destinationBalanceBeforePence: 0,
      expectedTransferTotalPence: 10_000,
      sourceLegs: [
        { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 10_000 },
      ],
      selectedUnpaidPayments: [payment('rent', 10_000)],
    });
    const corrupt: TransferPlanFundingRecord = {
      ...valid,
      billAttributions: [
        {
          ...valid.billAttributions[0],
          sourceShares: [
            { transactionId: 'tx-a', sourceAccountId: 'source-a', amountPence: 9_999 },
          ],
        },
      ],
    };

    expect(() => validateTransferPlanFundingRecord(corrupt)).toThrow(
      'do not match the attributed amount'
    );
  });
});
