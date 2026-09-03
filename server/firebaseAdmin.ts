import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import config from '../firebase-applet-config.json';

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedFirestore: Firestore | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  cachedApp = getApps().length > 0
    ? getApp()
    : initializeApp({
        credential: applicationDefault(),
        projectId: config.projectId,
      });

  return cachedApp;
}

function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getAdminApp());
  }
  return cachedAuth;
}

/**
 * Lazily returns the configured Firestore Admin client.
 *
 * The project uses a named Firestore database. Production Cloud Run must run
 * under a service account with explicit access to this database; no service
 * account key is stored in the repository.
 */
export function getAdminFirestore(): Firestore {
  if (cachedFirestore) return cachedFirestore;

  cachedFirestore = config.firestoreDatabaseId
    ? getFirestore(getAdminApp(), config.firestoreDatabaseId)
    : getFirestore(getAdminApp());

  return cachedFirestore;
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
