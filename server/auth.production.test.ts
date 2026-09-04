import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./firebaseAdmin', () => ({
  verifyFirebaseIdentity: vi.fn(),
}));

import { initDb, getDb } from './db';
import { authenticateRequest, ensureInitialOwner } from './auth';
import { verifyFirebaseIdentity } from './firebaseAdmin';

const originalNodeEnv = process.env.NODE_ENV;
const originalOwnerPassword = process.env.INITIAL_OWNER_PASSWORD;
const verifyFirebaseIdentityMock = vi.mocked(verifyFirebaseIdentity);

describe('production authentication hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'production';
    delete process.env.INITIAL_OWNER_PASSWORD;
    initDb(':memory:');
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalOwnerPassword === undefined) {
      delete process.env.INITIAL_OWNER_PASSWORD;
    } else {
      process.env.INITIAL_OWNER_PASSWORD = originalOwnerPassword;
    }
  });

  it('does not bootstrap an Owner password in production', () => {
    ensureInitialOwner();
    const row = getDb().prepare('SELECT count(*) as count FROM users').get() as { count: number };
    expect(row.count).toBe(0);
  });

  it.each(['/api/auth/login', '/api/auth/register', '/api/auth/switch'])(
    'does not expose local credential route %s in production',
    async (path) => {
      const status = vi.fn().mockReturnThis();
      const json = vi.fn().mockReturnThis();
      const next = vi.fn();

      await authenticateRequest(
        {
          path,
          method: 'POST',
          headers: {},
          body: {},
        } as any,
        { status, json } as any,
        next
      );

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'Not found' });
      expect(next).not.toHaveBeenCalled();
    }
  );

  it('rejects every verified non-Marius Firebase identity in single-user production mode', async () => {
    verifyFirebaseIdentityMock.mockResolvedValue({
      uid: 'firebase-guest-uid',
      email: 'guest@example.com',
      name: 'Guest User',
    });

    const req: any = {
      path: '/api/events',
      method: 'GET',
      headers: { cookie: 'other=value; mv_firebase_id=firebase-id-token' },
    };
    const next = vi.fn();

    await authenticateRequest(req, {} as any, next);

    expect(verifyFirebaseIdentityMock).toHaveBeenCalledWith('firebase-id-token');
    expect(req.user).toBeUndefined();
    const row = getDb().prepare('SELECT count(*) as count FROM users').get() as { count: number };
    expect(row.count).toBe(0);
    expect(next).toHaveBeenCalledOnce();
  });

  it('maps the verified Marius email to the sole Household Owner', async () => {
    verifyFirebaseIdentityMock.mockResolvedValue({
      uid: 'firebase-marius-uid',
      email: 'backtonemesis@gmail.com',
      name: 'Marius',
    });

    const req: any = {
      path: '/api/session',
      method: 'GET',
      headers: { authorization: 'Bearer firebase-owner-token' },
    };
    const next = vi.fn();

    await authenticateRequest(req, {} as any, next);

    expect(req.user).toMatchObject({
      email: 'backtonemesis@gmail.com',
      role: 'owner',
    });

    const owners = getDb().prepare("SELECT email FROM users WHERE role = 'owner'").all() as Array<{ email: string }>;
    expect(owners).toEqual([{ email: 'backtonemesis@gmail.com' }]);
  });
});
