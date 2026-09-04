import type { Account } from '../types';

const TYPE_LABELS: Record<Account['type'], string> = {
  current: 'Current',
  joint: 'Joint',
  savings: 'Savings',
  credit: 'Credit',
  cash: 'Cash',
};

export function accountDisplayLabel(account: Account): string {
  const parts = [
    account.name.trim(),
    account.ownerPerson?.trim(),
    TYPE_LABELS[account.type],
  ].filter(Boolean);
  return parts.join(' · ');
}

export function accountDisplayLabelWithBalance(
  account: Account,
  formatBalance: (pence: number) => string
): string {
  return `${accountDisplayLabel(account)} — ${formatBalance(account.currentBalancePence)}`;
}
