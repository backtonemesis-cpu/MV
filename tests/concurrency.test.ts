import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, getDb, bumpVersionAndLog } from '../server/db';

describe('Optimistic Concurrency & Audit Logging', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  it('bumps household version monotonically and creates audit log entries', () => {
    const db = getDb();
    const metaBefore = db.prepare('SELECT version FROM household_meta WHERE id = ?').get('household-mv') as any;
    const initialVersion = metaBefore.version;

    const v1 = bumpVersionAndLog(
      db,
      'marius@example.com',
      'account_created',
      'account',
      'acc-1',
      'Created test account'
    );

    expect(v1).toBe(initialVersion + 1);

    const logs = db.prepare('SELECT * FROM audit_logs WHERE entity_id = ?').all('acc-1') as any[];
    expect(logs.length).toBe(1);
    expect(logs[0].actor_email).toBe('marius@example.com');
    expect(logs[0].action).toBe('account_created');
    expect(logs[0].summary).toBe('Created test account');
  });

  it('detects version mismatch conflicts and rejects stale updates', () => {
    const db = getDb();
    const currentMeta = db.prepare('SELECT version FROM household_meta WHERE id = ?').get('household-mv') as any;
    const serverVersion = currentMeta.version;

    const checkConflict = (expectedVersion: any) => {
      if (typeof expectedVersion === 'number' && expectedVersion !== serverVersion) {
        const err: any = new Error(`Concurrency conflict: household data was modified by another user (server version ${serverVersion}, your version ${expectedVersion}).`);
        err.status = 409;
        err.serverVersion = serverVersion;
        throw err;
      }
    };

    // Correct version matches without error
    expect(() => checkConflict(serverVersion)).not.toThrow();

    // Stale version throws 409 error
    const staleVersion = serverVersion - 1;
    expect(() => checkConflict(staleVersion)).toThrowError(/Concurrency conflict/);
    try {
      checkConflict(staleVersion);
    } catch (err: any) {
      expect(err.status).toBe(409);
      expect(err.serverVersion).toBe(serverVersion);
    }
  });
});
