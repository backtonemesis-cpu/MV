import type { Account, Transaction } from '../../src/types';

/**
 * Calculate an account's current position from an authoritative balance anchor.
 *
 * Reconciliation rule:
 *   reconciled balance + actual movements strictly after the reconciliation date
 *
 * If an account has not been reconciled, startingBalancePence is the anchor and
 * all actual movements are applied. Internal transfers alter account balances but
 * remain neutral at household level.
 */
export function calculateCurrentBalancePence(
  account: Account,
  transactions: Transaction[]
): number {
  const hasReconciliation =
    Boolean(account.reconciliationDate) &&
    Number.isSafeInteger(account.reconciledBalancePence);

  let balance = hasReconciliation
    ? account.reconciledBalancePence!
    : account.startingBalancePence;

  const effectiveTransactions = transactions.filter((tx) => {
    if (!hasReconciliation) return true;
    return tx.date > account.reconciliationDate!;
  });

  for (const tx of effectiveTransactions) {
    if (tx.accountId === account.id) {
      if (tx.type === 'income') {
        balance += tx.amountPence;
      } else if (tx.type === 'refund' || tx.isRefund) {
        balance += tx.amountPence;
      } else if (tx.type === 'expense' || tx.type === 'repayment') {
        balance -= tx.amountPence;
      } else if (tx.type === 'transfer' && tx.isTransfer) {
        balance -= tx.amountPence;
      }
    }

    if (
      tx.targetAccountId === account.id &&
      tx.type === 'transfer' &&
      tx.isTransfer
    ) {
      balance += tx.amountPence;
    }
  }

  return balance;
}

export function withCalculatedAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Account[] {
  return accounts.map((account) => ({
    ...account,
    currentBalancePence: calculateCurrentBalancePence(account, transactions),
  }));
}
