import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getDb } from './db';
import { verifyFirebaseIdentity, type VerifiedFirebaseIdentity } from './firebaseAdmin';
import { UserRole } from '../src/types';
import { FirestoreHouseholdStore } from './storage/firestoreStore';
import { isFirestoreRuntime } from './storage/runtimeBackend';

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

const OWNER_EMAIL = 'backtonemesis@gmail.com';
const FIREBASE_COOKIE_NAME = 'mv_firebase_id';
const LOCAL_CREDENTIAL_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/switch',
]);

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
 * Development/test bootstrap only.
 *
 * Production identity is established exclusively from a verified Firebase ID token,
 * so production never creates an Owner from a password or a known fallback secret.
 */
export function ensureInitialOwner(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const db = getDb();
  const userCount = (db.prepare('SELECT count(*) as count FROM users').get() as any).count;
  if (userCount !== 0) return;

  const configuredPassword = process.env.INITIAL_OWNER_PASSWORD?.trim();
  const initialPassword = configuredPassword || crypto.randomBytes(32).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(initialPassword, salt);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, salt, display_name, role, joined_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'user-marius',
    OWNER_EMAIL,
    passwordHash,
    salt,
    'Marius',
    'owner',
    now
  );
}

function getCookieValue(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) return '';

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }

  return '';
}

function getLocalSessionUser(token: string): AuthenticatedUser | undefined {
  const db = getDb();
  const tokenHash = hashToken(token);
  const session = db.prepare(`
    SELECT s.token_hash, s.user_id, s.expires_at
    FROM user_sessions s
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash, Date.now()) as any;

  if (!session) return undefined;

  const userRow = db.prepare(
    'SELECT id, email, display_name, role FROM users WHERE id = ?'
  ).get(session.user_id) as any;

  if (!userRow) return undefined;

  db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    userRow.id
  );

  return {
    id: userRow.id,
    email: userRow.email,
    name: userRow.display_name,
    role: userRow.role as UserRole,
  };
}

function getOrCreateSqliteFirebaseUser(identity: VerifiedFirebaseIdentity): AuthenticatedUser {
  const db = getDb();
  const now = new Date().toISOString();
  let userRow = db.prepare(
    'SELECT id, email, display_name, role FROM users WHERE email = ?'
  ).get(identity.email) as any;

  if (!userRow) {
    let role: UserRole = 'pending';

    if (identity.email === OWNER_EMAIL) {
      const existingOwner = db.prepare(
        "SELECT id, email FROM users WHERE role = 'owner' LIMIT 1"
      ).get() as any;

      if (existingOwner && String(existingOwner.email).toLowerCase() !== OWNER_EMAIL) {
        throw new Error('Household Owner state requires administrator repair before sign-in can continue.');
      }

      role = 'owner';
    }

    const userId = `firebase-${crypto
      .createHash('sha256')
      .update(identity.uid)
      .digest('hex')
      .slice(0, 32)}`;

    // These columns remain for local/test authentication compatibility only.
    // Production password routes are disabled, and these random values are not credentials.
    const placeholderSalt = crypto.randomBytes(16).toString('hex');
    const placeholderHash = crypto.randomBytes(64).toString('hex');

    db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, display_name, role, joined_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      identity.email,
      placeholderHash,
      placeholderSalt,
      identity.name,
      role,
      now,
      now
    );

    db.prepare(`
      INSERT OR IGNORE INTO user_preferences (user_id, theme, accent_color, updated_at)
      VALUES (?, 'system', 'default', ?)
    `).run(userId, now);

    userRow = {
      id: userId,
      email: identity.email,
      display_name: identity.name,
      role,
    };
  } else {
    // The verified Owner email is authoritative for Owner identity. Never grant
    // Owner to any other email, and repair a stale non-owner role for Marius.
    if (identity.email === OWNER_EMAIL && userRow.role !== 'owner') {
      db.prepare("UPDATE users SET role = 'owner' WHERE id = ?").run(userRow.id);
      userRow.role = 'owner';
    }

    db.prepare(
      'UPDATE users SET display_name = ?, last_active_at = ? WHERE id = ?'
    ).run(identity.name, now, userRow.id);
    userRow.display_name = identity.name;
  }

  return {
    id: userRow.id,
    email: userRow.email,
    name: userRow.display_name,
    role: userRow.role as UserRole,
  };
}

let firestoreHouseholdStore: FirestoreHouseholdStore | null = null;

function getFirestoreHouseholdStore(): FirestoreHouseholdStore {
  if (!firestoreHouseholdStore) {
    firestoreHouseholdStore = new FirestoreHouseholdStore();
  }
  return firestoreHouseholdStore;
}

async function getOrCreateFirebaseUser(
  identity: VerifiedFirebaseIdentity
): Promise<AuthenticatedUser> {
  if (isFirestoreRuntime()) {
    const member = await getFirestoreHouseholdStore().getOrCreateVerifiedMember(identity);
    return {
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
    };
  }

  return getOrCreateSqliteFirebaseUser(identity);
}

/**
 * Production authentication accepts only Firebase ID tokens with a verified email.
 * Standard API calls send the token as a Bearer header. Browser EventSource cannot
 * set that header, so the same short-lived Firebase token may also arrive in a
 * Secure/SameSite cookie created by the authenticated client.
 *
 * Local password/session authentication remains available solely outside production
 * so existing automated tests and development fixtures can continue to work.
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (process.env.NODE_ENV === 'production' && LOCAL_CREDENTIAL_ROUTES.has(req.path)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const authHeader = req.headers['authorization'];
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token && process.env.NODE_ENV === 'production') {
    token = getCookieValue(req.headers.cookie, FIREBASE_COOKIE_NAME);
  }

  // Test-only token header. Never accepted in development or production.
  if (!token && process.env.NODE_ENV === 'test' && req.headers['x-test-auth-token']) {
    token = req.headers['x-test-auth-token'] as string;
  }

  if (!token) {
    req.user = undefined;
    next();
    return;
  }

  try {
    if (process.env.NODE_ENV === 'production') {
      const identity = await verifyFirebaseIdentity(token);
      req.user = await getOrCreateFirebaseUser(identity);
    } else {
      req.user = getLocalSessionUser(token);
    }
  } catch (err) {
    console.warn('[MV Auth] Authentication rejected:', err instanceof Error ? err.message : err);
    req.user = undefined;
  }

  next();
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
      error: 'Your account is pending approval by the household owner. No household financial data is accessible.',
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
