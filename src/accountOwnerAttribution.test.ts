import { describe, expect, it } from 'vitest';
import { JOINT_ACCOUNT_OWNER_ID } from './types';
import type { Account, HouseholdMember } from './types';
import { resolveAccountOwnerPayer } from './utils/accountOwner';

const members: HouseholdMember[] = [
  {
    id: 'member-marius',
    email: 'marius@local.invalid',
    name: 'Marius',
    role: 'owner',
    joinedAt: '2026-09-09T00:00:00.000Z',
  },
  {
    id: 'member-vesta',
    email: 'vesta@local.invalid',
    name: 'Vesta',
    role: 'editor',
    joinedAt: '2026-09-09T00:00:00.000Z',
  },
];

const account = (overrides: Partial<Account>): Account => ({
  id: 'account-1',
  name: 'Lloyds',
  type: 'current',
  currency: 'GBP',
  startingBalancePence: 0,
  currentBalancePence: 0,
  ...overrides,
});

describe('account-derived person attribution', () => {
  it('uses stable household-member ownership rather than a stale display label', () => {
    expect(
      resolveAccountOwnerPayer(
        account({ ownerMemberId: 'member-vesta', ownerPerson: 'Old name' }),
        members
      )
    ).toBe('Vesta');
  });

  it('records Joint automatically for a joint-owned account', () => {
    expect(
      resolveAccountOwnerPayer(
        account({ ownerMemberId: JOINT_ACCOUNT_OWNER_ID, ownerPerson: 'Joint' }),
        members
      )
    ).toBe('Joint');
  });

  it('retains legacy ownerPerson as a backwards-compatible fallback', () => {
    expect(resolveAccountOwnerPayer(account({ ownerPerson: 'Marius' }), members)).toBe('Marius');
  });

  it('does not invent an owner when account ownership cannot be resolved', () => {
    expect(resolveAccountOwnerPayer(account({}), members)).toBeNull();
  });
});
