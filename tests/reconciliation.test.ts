import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, getDb, recalculateAccountBalance } from '../server/db';

describe('Account Reconciliation & Anchor Preservation', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  it('preserves historical opening balance while establishing a forward reconciliation anchor', () => {
    const db = getDb();
    const now = new Date().toISOString();
    const accountId = 'acc-test-current';

    // Account opened with £500.00 starting balance
    db.prepare(`
      INSERT INTO accounts (
        id, name, type, currency, starting_balance_pence, current_balance_pence,
        owner_person, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, 'GBP', ?, ?, ?, 1, ?, ?)
    `).run(accountId, 'Current Account', 'current', 50000, 50000, 'Marius', now, now);

    // Initial transaction before reconciliation: £100 expense on 2026-08-10
    db.prepare(`
      INSERT INTO transactions (
        id, date, description, amount_pence, type, category_id, account_id,
        payer, created_at, created_by
      ) VALUES (?, ?, ?, ?, 'expense', 'cat-groceries', ?, 'Marius', ?, ?)
    `).run('tx-pre-1', '2026-08-10', 'Old groceries', 10000, accountId, now, 'marius@example.com');

    recalculateAccountBalance(db, accountId);
    let acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    expect(acc.current_balance_pence).toBe(40000); // £400.00

    // Perform reconciliation as of 2026-09-01 verified bank balance: £650.00
    const recTimestamp = new Date().toISOString();
    db.prepare(`
      UPDATE accounts SET
        reconciled_balance_pence = ?,
        reconciliation_date = ?,
        reconciled_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(65000, '2026-09-01', recTimestamp, recTimestamp, accountId);

    recalculateAccountBalance(db, accountId);
    acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;

    // Anchor properties MUST be retained and starting balance NOT rewritten
    expect(acc.starting_balance_pence).toBe(50000); // Preserved!
    expect(acc.reconciled_balance_pence).toBe(65000); // Anchor established
    expect(acc.reconciliation_date).toBe('2026-09-01');
    expect(acc.reconciled_at).toBe(recTimestamp);
    expect(acc.current_balance_pence).toBe(65000);

    // New transaction after reconciliation date: £75 expense on 2026-09-05
    db.prepare(`
      INSERT INTO transactions (
        id, date, description, amount_pence, type, category_id, account_id,
        payer, created_at, created_by
      ) VALUES (?, ?, ?, ?, 'expense', 'cat-groceries', ?, 'Marius', ?, ?)
    `).run('tx-post-1', '2026-09-05', 'Post-reconciliation bill', 7500, accountId, now, 'marius@example.com');

    recalculateAccountBalance(db, accountId);
    acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    expect(acc.current_balance_pence).toBe(57500); // £650 - £75 = £575.00

    // Adding an old transaction dated before reconciliation date (e.g. 2026-08-20)
    // MUST NOT modify the current balance anchored at 2026-09-01
    db.prepare(`
      INSERT INTO transactions (
        id, date, description, amount_pence, type, category_id, account_id,
        payer, created_at, created_by
      ) VALUES (?, ?, ?, ?, 'expense', 'cat-groceries', ?, 'Marius', ?, ?)
    `).run('tx-pre-2', '2026-08-20', 'Late recorded pre-reconciliation expense', 3000, accountId, now, 'marius@example.com');

    recalculateAccountBalance(db, accountId);
    acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    expect(acc.current_balance_pence).toBe(57500); // Unchanged! Anchor protected historical accuracy.
  });
});
