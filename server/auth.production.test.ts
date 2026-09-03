import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDb, getDb } from './db';
import { authenticateRequest, ensureInitialOwner } from './auth';

const originalNodeEnv = process.env.NODE_ENV;
const originalOwnerPassword = process.env.INITIAL_OWNER_PASSWORD;

describe('production authentication hardening', () => {
  beforeEach(() => {
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
});
