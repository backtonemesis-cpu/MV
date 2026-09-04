import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMvFirestore } from './firestoreAdmin';
import { createFirestoreAdminDataRouter } from './firestoreAdminDataRoutes';
import { FirestoreHouseholdStore } from './storage/firestoreStore';
import { HOUSEHOLD_ID } from './storage/contracts';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeEmulator('Firestore admin data HTTP routes', () => {
  const db = getMvFirestore();
  const store = new FirestoreHouseholdStore(db);
  const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
  let server: Server | null = null;
  let baseUrl = '';

  async function startApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const role = String(req.headers['x-test-role'] || 'owner') as any;
      const email =
        role === 'owner'
          ? 'backtonemesis@gmail.com'
          : role === 'editor'
            ? 'vestajuskaite@gmail.com'
            : 'viewer@example.com';
      req.user = {
        id: `firebase-${role}`,
        email,
        name: role,
        role,
      };
      next();
    });
    app.use('/api', createFirestoreAdminDataRouter({ db, store }));

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test HTTP server did not bind');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  async function request(
    path: string,
    method: string,
    body?: Record<string, unknown>,
    role = 'owner'
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-test-role': role,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
  }

  beforeEach(async () => {
    await db.recursiveDelete(householdRef);
    await store.ensureHousehold();
    await householdRef.collection('members').doc('firebase-owner').set({
      email: 'backtonemesis@gmail.com',
      name: 'Marius',
      role: 'owner',
      joinedAt: '2026-09-04T00:00:00.000Z',
    });
    await startApp();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve()))
      );
      server = null;
    }
  });

  afterAll(async () => {
    await db.recursiveDelete(householdRef);
  });

  it('allows Owner/Editor backup export but rejects View-only export', async () => {
    let result = await request('/api/backup', 'GET', undefined, 'owner');
    expect(result.response.status).toBe(200);
    expect(result.payload.exportVersion).toBe('3.0');

    result = await request('/api/backup', 'GET', undefined, 'editor');
    expect(result.response.status).toBe(200);

    result = await request('/api/backup', 'GET', undefined, 'view_only');
    expect(result.response.status).toBe(403);
  });

  it('allows only Owner to preflight/restore and requires an expectedVersion for restore', async () => {
    const exported = await request('/api/backup', 'GET', undefined, 'owner');
    const backup = exported.payload;

    let result = await request(
      '/api/restore/preflight',
      'POST',
      backup,
      'view_only'
    );
    expect(result.response.status).toBe(403);

    result = await request('/api/restore/preflight', 'POST', backup, 'owner');
    expect(result.response.status).toBe(200);
    expect(result.payload.valid).toBe(true);

    result = await request('/api/restore', 'POST', backup, 'owner');
    expect(result.response.status).toBe(400);
    expect(result.payload.error).toContain('expectedVersion');

    result = await request(
      '/api/restore',
      'POST',
      { ...backup, expectedVersion: 1 },
      'owner'
    );
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(2);
  });

  it('versions Owner-only reset and preserves the production absence of fixture/pseudo-test routes', async () => {
    let result = await request(
      '/api/household/reset',
      'POST',
      { expectedVersion: 1 },
      'editor'
    );
    expect(result.response.status).toBe(403);

    result = await request(
      '/api/household/reset',
      'POST',
      { expectedVersion: 1 },
      'owner'
    );
    expect(result.response.status).toBe(200);
    expect(result.payload.version).toBe(2);

    result = await request(
      '/api/household/load-sample-data',
      'POST',
      {},
      'owner'
    );
    expect(result.response.status).toBe(404);
    expect(result.payload.code).toBe('DEVELOPMENT_ONLY_CAPABILITY');

    result = await request('/api/tests/run', 'GET', undefined, 'owner');
    expect(result.response.status).toBe(404);
    expect(result.payload.code).toBe('DEVELOPMENT_ONLY_CAPABILITY');
  });
});
