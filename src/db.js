import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.js';
import {
  OWNER_EMAIL,
  PRIMARY_HOUSEHOLD_ID,
  ROLES,
  STATUSES,
  canManageMembers,
  initialMembershipForEmail,
} from './policy.js';
import { validateFinancialRecord } from './records.js';

function userRef(uid) {
  return doc(db, 'users', uid);
}

function householdRef() {
  return doc(db, 'households', PRIMARY_HOUSEHOLD_ID);
}

function recordsCollection() {
  return collection(db, 'households', PRIMARY_HOUSEHOLD_ID, 'records');
}

function auditRef() {
  return doc(collection(db, 'households', PRIMARY_HOUSEHOLD_ID, 'audit'));
}

function plainAuditRecord({ actorUid, action, entityType, entityId, before = null, after = null }) {
  return {
    actorUid,
    action,
    entityType,
    entityId,
    before,
    after,
    createdAt: serverTimestamp(),
  };
}

export async function ensureUserProfile(user) {
  if (!user?.uid || !user.email || !user.emailVerified) {
    throw new Error('A verified authenticated identity is required.');
  }

  const ref = userRef(user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, {
      displayName: user.displayName || existing.data().displayName || '',
      lastAccessAt: serverTimestamp(),
    });
    return { id: existing.id, ...existing.data() };
  }

  const membership = initialMembershipForEmail(user.email);
  await setDoc(ref, {
    email: user.email.toLowerCase(),
    displayName: user.displayName || '',
    ...membership,
    createdAt: serverTimestamp(),
    lastAccessAt: serverTimestamp(),
  });

  if (user.email.toLowerCase() === OWNER_EMAIL) {
    const hRef = householdRef();
    const household = await getDoc(hRef);
    if (!household.exists()) {
      await setDoc(hRef, {
        name: 'MV',
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
      });
    }
  }

  return { id: user.uid, email: user.email.toLowerCase(), displayName: user.displayName || '', ...membership };
}

export async function getCurrentProfile(uid) {
  const snapshot = await getDoc(userRef(uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function listPendingUsers(currentUid) {
  const current = await getCurrentProfile(currentUid);
  if (!canManageMembers(current)) throw new Error('Only the Household Owner can review pending users.');
  const snapshot = await getDocs(query(collection(db, 'users'), where('status', '==', STATUSES.PENDING)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function setMemberRole({ currentUid, memberUid, role }) {
  if (![ROLES.EDITOR, ROLES.VIEWER].includes(role)) throw new Error('Role must be editor or viewer.');
  const current = await getCurrentProfile(currentUid);
  if (!canManageMembers(current)) throw new Error('Only the Household Owner can approve members.');

  const batch = writeBatch(db);
  batch.update(userRef(memberUid), {
    status: STATUSES.APPROVED,
    role,
    householdId: PRIMARY_HOUSEHOLD_ID,
  });
  batch.set(auditRef(), plainAuditRecord({
    actorUid: currentUid,
    action: 'membership-approved',
    entityType: 'user',
    entityId: memberUid,
    after: { status: STATUSES.APPROVED, role, householdId: PRIMARY_HOUSEHOLD_ID },
  }));
  await batch.commit();
}

export async function removeMember({ currentUid, memberUid }) {
  const current = await getCurrentProfile(currentUid);
  if (!canManageMembers(current)) throw new Error('Only the Household Owner can remove members.');
  if (currentUid === memberUid) throw new Error('The Household Owner cannot remove themselves.');

  const batch = writeBatch(db);
  batch.update(userRef(memberUid), {
    status: STATUSES.REMOVED,
    role: ROLES.REMOVED,
    householdId: null,
  });
  batch.set(auditRef(), plainAuditRecord({
    actorUid: currentUid,
    action: 'membership-removed',
    entityType: 'user',
    entityId: memberUid,
    after: { status: STATUSES.REMOVED, role: ROLES.REMOVED, householdId: null },
  }));
  await batch.commit();
}

export async function createFinancialRecord({ actorUid, record }) {
  const sanitized = validateFinancialRecord(record);
  const ref = doc(recordsCollection());
  const data = {
    ...sanitized,
    revision: 1,
    createdBy: actorUid,
    createdAt: serverTimestamp(),
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(ref, data);
  batch.set(auditRef(), plainAuditRecord({
    actorUid,
    action: 'record-created',
    entityType: 'financial-record',
    entityId: ref.id,
    after: sanitized,
  }));
  await batch.commit();
  return ref.id;
}

export async function updateFinancialRecord({ actorUid, recordId, expectedRevision, patch }) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw new TypeError('expectedRevision must be a positive integer.');
  }

  const ref = doc(recordsCollection(), recordId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('The financial record no longer exists.');
    const current = snapshot.data();

    if (current.revision !== expectedRevision) {
      throw new Error('CONFLICT: This record changed since you opened it. Reload the latest version before saving.');
    }

    const sanitized = validateFinancialRecord({ ...current, ...patch });
    const nextRevision = current.revision + 1;
    transaction.update(ref, {
      ...sanitized,
      revision: nextRevision,
      updatedBy: actorUid,
      updatedAt: serverTimestamp(),
    });
    transaction.set(auditRef(), plainAuditRecord({
      actorUid,
      action: 'record-updated',
      entityType: 'financial-record',
      entityId: recordId,
      before: validateFinancialRecord(current),
      after: sanitized,
    }));
    return nextRevision;
  });
}

export async function deleteFinancialRecord({ actorUid, recordId, expectedRevision }) {
  const ref = doc(recordsCollection(), recordId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('The financial record no longer exists.');
    const current = snapshot.data();
    if (current.revision !== expectedRevision) {
      throw new Error('CONFLICT: This record changed since you opened it. Reload before deleting.');
    }
    transaction.delete(ref);
    transaction.set(auditRef(), plainAuditRecord({
      actorUid,
      action: 'record-deleted',
      entityType: 'financial-record',
      entityId: recordId,
      before: validateFinancialRecord(current),
    }));
  });
}
