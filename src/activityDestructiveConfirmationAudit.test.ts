import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Activity destructive confirmation contract', () => {
  it('does not use browser-native confirm for delete or generic transfer undo', () => {
    const activity = read('components/TransactionList.tsx');

    expect(activity).not.toContain('window.confirm');
    expect(activity).toContain("kind: 'delete'");
    expect(activity).toContain("kind: 'undo-transfer'");
  });

  it('uses the shared accessible in-app modal contract with Cancel initial focus', () => {
    const activity = read('components/TransactionList.tsx');

    expect(activity).toContain('pendingDestructiveAction');
    expect(activity).toContain('useModalAccessibility<HTMLDivElement>');
    expect(activity).toContain('role="dialog"');
    expect(activity).toContain('aria-modal="true"');
    expect(activity).toContain('data-modal-initial-focus');
    expect(activity).toContain('Delete transaction');
    expect(activity).toContain('Undo transfer');
  });

  it('shows exact transaction identity before a destructive action', () => {
    const activity = read('components/TransactionList.tsx');

    expect(activity).toContain('{transaction.description}');
    expect(activity).toContain('formatDateKeyUk(transaction.date)');
    expect(activity).toContain('categoriesMap.get(transaction.categoryId)');
    expect(activity).toContain('accountsMap.get(transaction.accountId)');
    expect(activity).toContain('formatPence(transaction.amountPence)');
  });

  it('warns when deleting linked planned evidence', () => {
    const activity = read('components/TransactionList.tsx');

    expect(activity).toContain('transaction.plannedPaymentId || transaction.plannedIncomeId');
    expect(activity).toContain('Deleting it will update the linked status to match the remaining financial evidence.');
  });

  it('preserves the existing mutation callback for confirmed actions', () => {
    const activity = read('components/TransactionList.tsx');

    expect(activity).toContain('onDeleteTransaction(transactionId)');
    expect(activity).toContain('Transfer Plan funding and Savings-managed transfers must be undone from their own views.');
  });
});
