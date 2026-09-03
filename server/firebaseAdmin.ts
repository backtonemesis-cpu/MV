import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getMvFirestore } from './firestoreAdmin';

let cachedAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const app = getApps().length > 0
    ? getApp()
    : initializeApp({ credential: applicationDefault() });

  cachedAuth = getAuth(app);
  return cachedAuth;
}

/**
 * Compatibility export for server-side storage modules. The implementation is
 * intentionally delegated to firestoreAdmin.ts so production database selection
 * remains fail-closed on the stable (default) Firestore database.
 */
export const getAdminFirestore = getMvFirestore;

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  name: string;
}

export async function verifyFirebaseIdentity(idToken: string): Promise<VerifiedFirebaseIdentity> {
  const decoded: DecodedIdToken = await getAdminAuth().verifyIdToken(idToken, true);

  if (!decoded.email || decoded.email_verified !== true) {
    throw new Error('A verified email address is required.');
  }

  const email = decoded.email.trim().toLowerCase();
  const name = typeof decoded.name === 'string' && decoded.name.trim()
    ? decoded.name.trim()
    : email.split('@')[0];

  return {
    uid: decoded.uid,
    email,
    name,
  };
}
