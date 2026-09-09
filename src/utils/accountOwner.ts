import { Account, HouseholdMember, JOINT_ACCOUNT_OWNER_ID, Payer } from '../types';

/**
 * Resolve the audit/display person attributable to an account.
 * Stable ownerMemberId is authoritative when present; ownerPerson is retained
 * only as a backwards-compatible fallback for normalized legacy data.
 */
export function resolveAccountOwnerPayer(
  account: Pick<Account, 'ownerMemberId' | 'ownerPerson'> | undefined,
  members: HouseholdMember[]
): Payer | null {
  if (!account) return null;

  if (account.ownerMemberId === JOINT_ACCOUNT_OWNER_ID) return 'Joint';

  if (account.ownerMemberId) {
    const member = members.find(
      (candidate) => candidate.id === account.ownerMemberId && candidate.role !== 'removed'
    );
    if (member?.name.trim()) return member.name.trim();
  }

  const legacyOwner = account.ownerPerson?.trim();
  return legacyOwner || null;
}
