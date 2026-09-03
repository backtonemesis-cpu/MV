import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getDb } from './db';
import { UserRole } from '../src/types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const computedHash = hashPassword(password, salt);
  const storedBuf = Buffer.from(storedHash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');
  if (storedBuf.length !== computedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedBuf, computedBuf);
}

/**
 * Ensures Marius (backtonemesis@gmail.com) exists as initial owner if no users exist.
 */
export function ensureInitialOwner(): void {
  const db = getDb();
  const userCount = (db.prepare('SELECT count(*) as count FROM users').get() as any).count;
  if (userCount === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    // Default initial password for Marius in fresh database setup: 'Household2026!'
    // Marius can change this immediately or sign in
    const defaultPassword = process.env.INITIAL_OWNER_PASSWORD || 'Household2026!';
    const passwordHash = hashPassword(defaultPassword, salt);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, display_name, role, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'user-marius',
      'backtonemesis@gmail.com',
      passwordHash,
      salt,
      'Marius',
      'owner',
      now
    );
  }
}

/**
 * Extracts and validates the cryptographic session token from Authorization header or cookie.
 */
export function authenticateRequest(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // Also check dev header ONLY if explicitly permitted in non-production automated testing
  if (!token && process.env.NODE_ENV === 'test' && req.headers['x-test-auth-token']) {
    token = req.headers['x-test-auth-token'] as string;
  }

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const db = getDb();
    const tokenHash = hashToken(token);
    const session = db.prepare(`
      SELECT s.token_hash, s.user_id, s.email, s.role, s.expires_at, u.display_name
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(tokenHash, Date.now()) as any;

    if (!session) {
      req.user = undefined;
      return next();
    }

    // Check user's current role from users table (in case it was updated or removed)
    const userRow = db.prepare('SELECT id, email, display_name, role FROM users WHERE id = ?').get(session.user_id) as any;
    if (!userRow) {
      req.user = undefined;
      return next();
    }

    req.user = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.display_name,
      role: userRow.role as UserRole,
    };

    // Update last_active_at periodically
    db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      userRow.id
    );

    return next();
  } catch (err) {
    req.user = undefined;
    return next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: Valid authenticated session required' });
    return;
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Action requires one of roles [${allowedRoles.join(', ')}], current role is '${req.user.role}'`,
        role: req.user.role,
      });
      return;
    }
    next();
  };
}

export function requireRead(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }
  if (req.user.role === 'pending') {
    res.status(403).json({
      error: 'Your account is pending approval by the household owner Marius (backtonemesis@gmail.com). No financial data is accessible.',
      role: 'pending',
    });
    return;
  }
  if (req.user.role === 'removed') {
    res.status(403).json({
      error: 'Your account has been removed from this household. Access denied.',
      role: 'removed',
    });
    return;
  }
  next();
}

export function requireWrite(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }
  if (req.user.role === 'view_only') {
    res.status(403).json({
      error: 'Forbidden: View-only members cannot modify household financial data.',
      role: 'view_only',
    });
    return;
  }
  if (req.user.role === 'pending' || req.user.role === 'removed') {
    res.status(403).json({
      error: 'Forbidden: Inactive or pending member cannot write financial data.',
      role: req.user.role,
    });
    return;
  }
  next();
}
