import { spawnSync } from 'node:child_process';
import {
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  'regal-campus-198sv';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'test-production-preflight.mjs must run with FIRESTORE_EMULATOR_HOST set'
  );
}

if (getApps().length === 0) {
  initializeApp({ projectId });
}

const db = getFirestore();
const householdRef = db.collection('households').doc('household-mv');
const stateRef = householdRef.collection('meta').doc('state');

function runPreflight(envOverrides = {}) {
  return spawnSync(
    process.execPath,
    ['scripts/production-preflight.mjs'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        K_SERVICE: 'mv-ci',
        K_REVISION: 'mv-ci-00001',
        MV_DATA_BACKEND: 'firestore',
        MV_FIRESTORE_DATABASE_ID: '(default)',
        ...envOverrides,
      },
      encoding: 'utf8',
      timeout: 30000,
    }
  );
}

function assertExit(result, expected, label) {
  if (result.status !== expected) {
    throw new Error(
      label +
        ' expected exit ' +
        expected +
        ' but got ' +
        String(result.status) +
        '\nstdout:\n' +
        result.stdout +
        '\nstderr:\n' +
        result.stderr
    );
  }
}

function assertIncludes(result, expected, label) {
  const combined = String(result.stdout || '') + String(result.stderr || '');
  if (!combined.includes(expected)) {
    throw new Error(
      label +
        " expected output containing '" +
        expected +
        "' but got:\n" +
        combined
    );
  }
}

async function reset() {
  await db.recursiveDelete(householdRef);
}

try {
  await reset();

  let result = runPreflight();
  assertExit(result, 0, 'empty default Firestore');
  assertIncludes(
    result,
    'Cloud Run Firestore preflight passed',
    'empty default Firestore'
  );
  assertIncludes(
    result,
    'Empty-household bootstrap is allowed',
    'empty default Firestore'
  );

  result = runPreflight({
    MV_DATA_BACKEND: 'sqlite',
  });
  assertExit(result, 78, 'Cloud Run SQLite');
  assertIncludes(
    result,
    'Refusing Cloud Run startup with SQLite',
    'Cloud Run SQLite'
  );

  result = runPreflight({
    MV_FIRESTORE_DATABASE_ID:
      'ai-studio-mv-02fb52df-6e5f-458e-bc1e-b1fdc07a8db7',
  });
  assertExit(result, 78, 'named Firestore database');
  assertIncludes(
    result,
    'Refusing production database',
    'named Firestore database'
  );

  await stateRef.set({
    version: 7,
    schemaVersion: 3,
    migrationState: 'loading',
  });
  result = runPreflight();
  assertExit(result, 78, 'incomplete migration state');
  assertIncludes(
    result,
    "migrationState='loading' is not complete",
    'incomplete migration state'
  );

  await stateRef.set({
    version: 8,
    schemaVersion: 3,
    migrationState: 'complete',
  });
  result = runPreflight();
  assertExit(result, 0, 'complete migration state');
  assertIncludes(
    result,
    'household state version=8',
    'complete migration state'
  );

  await stateRef.set({
    version: 'broken',
    schemaVersion: 3,
  });
  result = runPreflight();
  assertExit(result, 78, 'invalid dataset version');
  assertIncludes(
    result,
    'invalid dataset version',
    'invalid dataset version'
  );

  await reset();
  result = runPreflight({
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:9',
    MV_FIRESTORE_PREFLIGHT_TIMEOUT_MS: '2000',
  });
  assertExit(result, 78, 'unreachable Firestore');
  assertIncludes(
    result,
    'readiness could not be proven',
    'unreachable Firestore'
  );

  console.log('Production storage preflight matrix passed.');
} finally {
  await reset();
  await db.terminate();
}
