import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, getDb } from '../server/db';
import { validateTransactionInput } from '../server/validation';
import { Transaction } from '../src/types';

describe('Split Transactions & Category Spending Attribution', () => {
  beforeEach(() => {
    const db = initDb(':memory:');
    const now = new Date().toISOString();
    // Insert test account so foreign key validation passes
    db.prepare(`
      INSERT INTO accounts (id, name, type, currency, starting_balance_pence, current_balance_pence, owner_person, is_active, created_at, updated_at)
      VALUES ('acc-current', 'Current Account', 'current', 'GBP', 50000, 50000, 'Marius', 1, ?, ?)
    `).run(now, now);
  });

  it('validates that the sum of split amounts strictly equals the parent transaction amount', () => {
    const validSplitPayload = {
      date: '2026-09-02',
      description: 'Supermarket weekly shop with pharmacy',
      amountPence: 7550, // £75.50
      type: 'expense',
      categoryId: 'cat-groceries',
      accountId: 'acc-current',
      payer: 'Marius',
      splits: [
        {
          categoryId: 'cat-groceries',
          amountPence: 6050, // £60.50
          notes: 'Food & drinks',
        },
        {
          categoryId: 'cat-health',
          amountPence: 1500, // £15.00
          notes: 'Prescriptions',
        },
      ],
    };

    const { errors, sanitized } = validateTransactionInput(validSplitPayload);
    expect(errors.length).toBe(0);
    expect(sanitized.splits?.length).toBe(2);

    // Mismatched splits: 6050 + 1000 = 7050 != 7550
    const invalidSplitPayload = {
      ...validSplitPayload,
      splits: [
        { categoryId: 'cat-groceries', amountPence: 6050 },
        { categoryId: 'cat-health', amountPence: 1000 },
      ],
    };

    const invalidResult = validateTransactionInput(invalidSplitPayload);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
    expect(invalidResult.errors.some((e) => e.message.includes('Sum of splits'))).toBe(true);
  });

  it('correctly calculates spending per category across standard, split, and refund transactions', () => {
    const transactions: Transaction[] = [
      // Standard transaction
      {
        id: 'tx-1',
        date: '2026-09-02',
        description: 'Shell Petrol',
        amountPence: 4500, // £45.00
        type: 'expense',
        categoryId: 'cat-transport',
        accountId: 'acc-current',
        payer: 'Marius',
        createdAt: '2026-09-02T10:00:00.000Z',
        createdBy: 'marius@example.com',
      },
      // Split transaction
      {
        id: 'tx-2',
        date: '2026-09-03',
        description: 'Sainsburys',
        amountPence: 5000, // £50.00
        type: 'expense',
        categoryId: 'cat-groceries',
        accountId: 'acc-current',
        payer: 'Marius',
        splits: [
          { id: 'sp-1', transactionId: 'tx-2', categoryId: 'cat-groceries', amountPence: 3500 },
          { id: 'sp-2', transactionId: 'tx-2', categoryId: 'cat-health', amountPence: 1500 },
        ],
        createdAt: '2026-09-03T10:00:00.000Z',
        createdBy: 'marius@example.com',
      },
      // Refund transaction
      {
        id: 'tx-3',
        date: '2026-09-05',
        description: 'Boots return prescription item',
        amountPence: 500, // £5.00 refund
        type: 'refund',
        isRefund: true,
        categoryId: 'cat-health',
        accountId: 'acc-current',
        payer: 'Marius',
        createdAt: '2026-09-05T10:00:00.000Z',
        createdBy: 'marius@example.com',
      },
    ];

    // Compute category spending
    const spendMap = new Map<string, number>();
    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        if (tx.splits && tx.splits.length > 0) {
          tx.splits.forEach((s) => {
            spendMap.set(s.categoryId, (spendMap.get(s.categoryId) || 0) + s.amountPence);
          });
        } else {
          spendMap.set(tx.categoryId, (spendMap.get(tx.categoryId) || 0) + tx.amountPence);
        }
      } else if (tx.type === 'refund' || tx.isRefund) {
        spendMap.set(tx.categoryId, Math.max(0, (spendMap.get(tx.categoryId) || 0) - tx.amountPence));
      }
    });

    expect(spendMap.get('cat-transport')).toBe(4500); // £45.00
    expect(spendMap.get('cat-groceries')).toBe(3500); // £35.00 from split
    expect(spendMap.get('cat-health')).toBe(1000); // £15.00 split - £5.00 refund = £10.00
  });
});
