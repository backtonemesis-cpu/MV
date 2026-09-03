export const PRIMARY_HOUSEHOLD_ID = 'mv-primary';
export const OWNER_EMAIL = 'backtonemesis@gmail.com';

export const ROLES = Object.freeze({
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
  PENDING: 'pending',
  REMOVED: 'removed',
});

export const STATUSES = Object.freeze({
  APPROVED: 'approved',
  PENDING: 'pending',
  REMOVED: 'removed',
});

export function initialMembershipForEmail(email) {
  if (typeof email !== 'string' || !email.trim()) throw new TypeError('A verified email is required.');
  const normalized = email.trim().toLowerCase();
  if (normalized === OWNER_EMAIL) {
    return { householdId: PRIMARY_HOUSEHOLD_ID, role: ROLES.OWNER, status: STATUSES.APPROVED };
  }
  return { householdId: null, role: ROLES.PENDING, status: STATUSES.PENDING };
}

export function canReadHousehold(profile, householdId = PRIMARY_HOUSEHOLD_ID) {
  return Boolean(
    profile
      && profile.status === STATUSES.APPROVED
      && profile.householdId === householdId
      && [ROLES.OWNER, ROLES.EDITOR, ROLES.VIEWER].includes(profile.role),
  );
}

export function canEditHousehold(profile, householdId = PRIMARY_HOUSEHOLD_ID) {
  return canReadHousehold(profile, householdId) && [ROLES.OWNER, ROLES.EDITOR].includes(profile.role);
}

export function canManageMembers(profile, householdId = PRIMARY_HOUSEHOLD_ID) {
  return canReadHousehold(profile, householdId) && profile.role === ROLES.OWNER;
}
