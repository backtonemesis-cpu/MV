import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { resolveProductionFirestoreDatabaseId } from './firestoreConfig';

function getAdminApp(): App {
  return getApps().length > 0
    ? getApp()
    : initializeApp({ credential: applicationDefault() });
}

/**
 * Stable production Firestore client.
 *
 * Intentionally uses getFirestore(app) for the default database. Do not change
 * this to the named-database overload until Firebase documents that overload as
 * production-supported rather than Public Preview.
 */
export function getMvFirestore(): Firestore {
  resolveProductionFirestoreDatabaseId();
  return getFirestore(getAdminApp());
}

export async function checkMvFirestoreReadiness(): Promise<{
  databaseId: string;
  reachable: boolean;
}> {
  const databaseId = resolveProductionFirestoreDatabaseId();
  const db = getMvFirestore();

  // A missing state document is an acceptable empty-database condition. The read
  // itself proves credentials/database reachability without inventing household data.
  await db.doc('households/household-mv/meta/state').get();

  return {
    databaseId,
    reachable: true,
  };
}
