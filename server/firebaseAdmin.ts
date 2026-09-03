import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';

let cachedAuth: Auth | null = null;

function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const app = getApps().length > 0
    ? getApp()
    : initializeApp({ credential: applicationDefault() });

  cachedAuth = getAuth(app);
  return cachedAuth;
}

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
