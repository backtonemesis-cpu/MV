import { describe, it, expect, beforeEach } from 'vitest';
import { initDb, getDb } from '../server/db';
import { hashPassword, verifyPassword, createSessionToken, hashToken } from '../server/auth';

describe('Authentication & Role Enforcement', () => {
  beforeEach(() => {
    // In-memory test database for clean isolation
    initDb(':memory:');
  });

  it('correctly hashes passwords with unique salts and verifies matches', () => {
    const salt1 = 'salt_alpha_123';
    const salt2 = 'salt_beta_456';
    const password = 'StrongPassword!2026';

    const hash1 = hashPassword(password, salt1);
    const hash2 = hashPassword(password, salt2);

    expect(hash1).not.toBe(hash2);
    expect(verifyPassword(password, salt1, hash1)).toBe(true);
    expect(verifyPassword(password, salt2, hash2)).toBe(true);
    expect(verifyPassword('WrongPassword', salt1, hash1)).toBe(false);
  });

  it('generates high-entropy cryptographic session tokens and hashes them for storage', () => {
    const token = createSessionToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(32);

    const tokenHash = hashToken(token);
    expect(tokenHash).toBeDefined();
    expect(tokenHash).not.toBe(token);
    expect(hashToken(token)).toBe(tokenHash);
  });

  it('persists authenticated user sessions in the database with role assignment', () => {
    const db = getDb();
    const now = new Date().toISOString();
    const salt = 'testsalt123';
    const pwHash = hashPassword('Household2026!', salt);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, display_name, role, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('user-test-1', 'owner@example.com', pwHash, salt, 'Test Owner', 'owner', now);

    const token = createSessionToken();
    const tokenHash = hashToken(token);
    const expiresAt = Date.now() + 3600000;

    db.prepare(`
      INSERT INTO user_sessions (token_hash, user_id, email, role, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tokenHash, 'user-test-1', 'owner@example.com', 'owner', expiresAt, now);

    const session = db.prepare('SELECT * FROM user_sessions WHERE token_hash = ?').get(tokenHash) as any;
    expect(session).toBeDefined();
    expect(session.email).toBe('owner@example.com');
    expect(session.role).toBe('owner');
  });
});
