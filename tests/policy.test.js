import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OWNER_EMAIL,
  PRIMARY_HOUSEHOLD_ID,
  ROLES,
  STATUSES,
  canEditHousehold,
  canManageMembers,
  canReadHousehold,
  initialMembershipForEmail,
} from '../src/policy.js';

test('only the verified owner email bootstraps as owner', () => {
  assert.deepEqual(initialMembershipForEmail(OWNER_EMAIL), {
    householdId: PRIMARY_HOUSEHOLD_ID,
    role: ROLES.OWNER,
    status: STATUSES.APPROVED,
  });
  assert.deepEqual(initialMembershipForEmail('vestajuskaite@gmail.com'), {
    householdId: null,
    role: ROLES.PENDING,
    status: STATUSES.PENDING,
  });
});

test('pending user cannot read or edit household data', () => {
  const pending = { householdId: null, role: ROLES.PENDING, status: STATUSES.PENDING };
  assert.equal(canReadHousehold(pending), false);
  assert.equal(canEditHousehold(pending), false);
  assert.equal(canManageMembers(pending), false);
});

test('viewer reads, editor edits, only owner manages membership', () => {
  const viewer = { householdId: PRIMARY_HOUSEHOLD_ID, role: ROLES.VIEWER, status: STATUSES.APPROVED };
  const editor = { householdId: PRIMARY_HOUSEHOLD_ID, role: ROLES.EDITOR, status: STATUSES.APPROVED };
  const owner = { householdId: PRIMARY_HOUSEHOLD_ID, role: ROLES.OWNER, status: STATUSES.APPROVED };
  assert.equal(canReadHousehold(viewer), true);
  assert.equal(canEditHousehold(viewer), false);
  assert.equal(canEditHousehold(editor), true);
  assert.equal(canManageMembers(editor), false);
  assert.equal(canManageMembers(owner), true);
});
