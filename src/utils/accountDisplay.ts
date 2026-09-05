import type { Account, AccountType } from '../types';
import { formatPence } from './currency';

export function accountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'current':
      return 'Current';
    case 'savings':
      return 'Savings';
    case 'credit':
      return 'Credit';
    case 'cash':
      return 'Cash';
    case 'joint':
      return 'Joint';
    default:
      return type;
  }
}

export function accountOwnerLabel(account: Account): string {
  if (account.ownerPerson?.trim()) return account.ownerPerson.trim();
  if (account.type === 'joint') return 'Joint';
  return 'Owner not set';
}

export function accountIdentityLabel(account: Account): string {
  return `${account.name} · ${accountTypeLabel(account.type)} · ${accountOwnerLabel(account)}`;
}

export function accountOptionLabel(
  account: Account,
  options: { includeBalance?: boolean } = {}
): string {
  const { includeBalance = true } = options;
  return includeBalance
    ? `${accountIdentityLabel(account)} · ${formatPence(account.currentBalancePence)}`
    : accountIdentityLabel(account);
}
