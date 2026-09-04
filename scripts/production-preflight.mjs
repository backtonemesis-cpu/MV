import {
  applicationDefault,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EXIT_CONFIG = 78;
const DEFAULT_DATABASE_ID = '(default)';
const HOUSEHOLD_STATE_PATH = 'households/household-mv/meta/state';

const isCloudRun = Boolean(
  process.env.K_SERVICE ||
    process.env.K_REVISION ||
    process.env.K_CONFIGURATION
);

const backend = String(process.env.MV_DATA_BACKEND || 'sqlite')
  .trim()
  .toLowerCase();

function refuse(message) {
  console.error(message);
  process.exit(EXIT_CONFIG);
}

if (backend !== 'sqlite' && backend !== 'firestore') {
  refuse(
    "[MV Storage] Refusing startup: MV_DATA_BACKEND='" +
      backend +
      "' is unsupported. Expected 'sqlite' or 'firestore'."
  );
}

if (backend === 'sqlite') {
  if (isCloudRun) {
    refuse(
      '[MV Storage] Refusing Cloud Run startup with SQLite. ' +
        'The Cloud Run container filesystem is not an approved durable authoritative datastore for MV household finances.'
    );
  }

  console.log('[MV Storage] Local SQLite backend accepted outside Cloud Run.');
  process.exit(0);
}

const databaseId = String(
  process.env.MV_FIRESTORE_DATABASE_ID || DEFAULT_DATABASE_ID
).trim();

if (databaseId !== DEFAULT_DATABASE_ID) {
  refuse(
    "[MV Firestore] Refusing production database '" +
      databaseId +
      "'. MV authoritative production data requires the stable default Firestore database API (" +
      DEFAULT_DATABASE_ID +
      ').'
  );
}

try {
  if (getApps().length === 0) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      initializeApp({
        projectId:
          process.env.GOOGLE_CLOUD_PROJECT ||
          process.env.GCLOUD_PROJECT ||
          'regal-campus-198sv',
      });
    } else {
      initializeApp({ credential: applicationDefault() });
    }
  }

  // getFirestore() without a database ID is intentional: production must use
  // the stable default-database Admin API, never the named-database overload.
  const db = getFirestore();
  const stateSnapshot = await db.doc(HOUSEHOLD_STATE_PATH).get();

  if (stateSnapshot.exists) {
    const state = stateSnapshot.data() || {};
    const migrationState = String(state.migrationState || '').trim();

    if (migrationState && migrationState !== 'complete') {
      refuse(
        "[MV Firestore] Refusing startup: household migrationState='" +
          migrationState +
          "' is not complete."
      );
    }

    if (!Number.isSafeInteger(state.version) || state.version < 1) {
      refuse(
        '[MV Firestore] Refusing startup: existing household meta/state has an invalid dataset version.'
      );
    }

    if (!Number.isSafeInteger(state.schemaVersion) || state.schemaVersion < 1) {
      refuse(
        '[MV Firestore] Refusing startup: existing household meta/state has an invalid schema version.'
      );
    }

    console.log(
      '[MV Firestore] Default database reachable; household state version=' +
        state.version +
        ', schemaVersion=' +
        state.schemaVersion +
        ', migrationState=' +
        (migrationState || 'native') +
        '.'
    );
  } else {
    console.log(
      '[MV Firestore] Default database reachable; no household meta/state exists yet. Empty-household bootstrap is allowed.'
    );
  }

  if (isCloudRun) {
    console.log(
      '[MV Storage] Cloud Run Firestore preflight passed. SQLite remains prohibited.'
    );
  } else {
    console.log('[MV Storage] Firestore preflight passed.');
  }

  // This is a one-shot gate executed before the real server process. Exit
  // explicitly so Firestore/gRPC resources cannot keep npm start blocked.
  process.exit(0);
} catch (error) {
  refuse(
    '[MV Firestore] Refusing startup because default Firestore readiness could not be proven: ' +
      (error instanceof Error ? error.message : String(error))
  );
}
