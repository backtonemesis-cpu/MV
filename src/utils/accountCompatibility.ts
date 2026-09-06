import type { Account } from '../types';

/**
 * Resolves a legacy account reference without ever guessing between same-name accounts.
 *
 * Matching hierarchy:
 * 1. Exact stable account ID.
 * 2. Unique normalized name + account type.
 * 3. Stable owner member ID when same-name/type candidates are ambiguous.
 * 4. Legacy owner display name only when it resolves to one candidate.
 */
export function resolveCompatibleAccount(
  oldAccount: Pick<Account, 'id' | 'name' | 'type' | 'ownerMemberId' | 'ownerPerson'>,
  candidateAccounts: Pick<
    Account,
    'id' | 'name' | 'type' | 'ownerMemberId' | 'ownerPerson'
  >[]
): Account | undefined {
  const exactMatch = candidateAccounts.find(
    (candidate) => candidate.id === oldAccount.id
  );
  if (exactMatch) return exactMatch as Account;

  const normalized = (value?: string) =>
    value?.trim().toLowerCase() || '';

  const nameTypeCandidates = candidateAccounts.filter(
    (candidate) =>
      normalized(candidate.name) === normalized(oldAccount.name) &&
      candidate.type === oldAccount.type
  );

  if (nameTypeCandidates.length === 1) {
    return nameTypeCandidates[0] as Account;
  }

  if (nameTypeCandidates.length > 1) {
    const ownerMemberId = oldAccount.ownerMemberId?.trim();
    if (ownerMemberId) {
      const memberMatches = nameTypeCandidates.filter(
        (candidate) => candidate.ownerMemberId === ownerMemberId
      );
      if (memberMatches.length === 1) return memberMatches[0] as Account;
      if (memberMatches.length > 1) return undefined;
    }

    const ownerName = normalized(oldAccount.ownerPerson);
    if (!ownerName) return undefined;

    const ownerMatches = nameTypeCandidates.filter(
      (candidate) => normalized(candidate.ownerPerson) === ownerName
    );
    if (ownerMatches.length === 1) return ownerMatches[0] as Account;
  }

  return undefined;
}
