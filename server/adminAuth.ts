/**
 * Admin session handling for the API.
 *
 * Responsibilities:
 *  - verify credentials against the bcrypt digest stored in `admin_users`
 *  - issue a signed, expiring session token on success
 *  - reject requests that do not carry a valid token
 *
 * Passwords are only ever compared in their hashed form; the plain-text value
 * exists solely inside the login request handler and is never logged or stored.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyPassword } from './adminPassword';
import { AUTH_REQUIRED, SESSION_EXPIRED } from '../shared/adminAuthMessages';
import { prisma } from './db';

/** Session lifetime. Long enough to survive a working day, short enough to expire. */
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

/** Issuer claim stamped on every admin token. */
const TOKEN_ISSUER = 'kinetic-admin';

/**
 * Development-only signing key.
 *
 * It exists purely so a fresh clone can sign in before anyone configures a real
 * secret. It is a published constant in the repository, so a token signed with it
 * can be forged by anyone who can read the source. `assertSigningSecretIsSafe`
 * refuses to start a production server while this is in use.
 */
const DEFAULT_SECRET = 'kinetic-dev-secret-change-me';

/** True when the process is running with the published development key. */
function usingDevelopmentSecret(): boolean {
  return jwtSecret() === DEFAULT_SECRET;
}

/**
 * Refuse to run a deployed server on the published development key.
 *
 * Failing at boot is the only safe outcome: a silent fallback would hand out
 * fully privileged sessions signed with a key that is public knowledge. Local
 * development keeps working, with a warning, because that is where the fallback
 * is actually useful.
 */
export function assertSigningSecretIsSafe(): void {
  if (!usingDevelopmentSecret()) return;
  const message =
    'ADMIN_JWT_SECRET is not set to a strong value, so admin sessions are signed ' +
    'with the public development key in server/adminAuth.ts. Anyone who can read ' +
    'this repository can forge an admin token. Generate one with: ' +
    'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  console.warn(`\n⚠️  INSECURE: ${message}\n`);
}

/**
 * Secret used to sign and verify tokens.
 *
 * Reads ADMIN_JWT_SECRET from the environment, falling back to the development
 * constant only when the variable is missing or too short to be meaningful.
 */
function jwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    return DEFAULT_SECRET;
  }
  return secret;
}

export interface AdminTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthenticatedAdmin extends AdminTokenPayload {
  adminId: string;
}

/** Shape stored on the request once `requireAdmin` has accepted a token. */
export interface AdminRequest extends Request {
  admin?: AuthenticatedAdmin;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, jwtSecret(), {
    issuer: TOKEN_ISSUER,
    expiresIn: SESSION_DURATION_SECONDS,
  });
}

/** Verify a token and return its payload, or null when it is absent or invalid. */
export function verifyAdminToken(token: string | null): AdminTokenPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret());
    if (typeof decoded === 'string') return null;
    const { sub, email, name, role } = decoded as Partial<AdminTokenPayload>;
    if (typeof sub !== 'string' || typeof email !== 'string') return null;
    return {
      sub,
      email,
      name: typeof name === 'string' ? name : email,
      role: typeof role === 'string' ? role : 'ADMIN',
    };
  } catch {
    // Covers expired, tampered, and malformed tokens alike.
    return null;
  }
}

/** Extract a bearer token from the Authorization header. */
export function bearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

export interface CredentialResult {
  admin: AuthenticatedAdmin | null;
  /** Set when no account matched the submitted email. */
  emailUnknown: boolean;
}

/**
 * Check submitted credentials against stored admin accounts.
 *
 * A missing account and a wrong password both resolve to `admin: null`; the
 * caller reports the same message either way so the response cannot be used to
 * enumerate valid admin addresses.
 */
export async function authenticateAdmin(
  email: unknown,
  password: unknown
): Promise<CredentialResult> {
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { admin: null, emailUnknown: false };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { admin: null, emailUnknown: false };

  const account = await prisma.adminUser.findUnique({ where: { email: normalizedEmail } });
  if (!account) return { admin: null, emailUnknown: true };

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) return { admin: null, emailUnknown: false };

  const payload: AdminTokenPayload = {
    sub: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
  };
  return { admin: { ...payload, adminId: account.id }, emailUnknown: false };
}

/**
 * Express middleware that admits only requests carrying a valid admin token.
 *
 * On success the decoded admin is attached to `req.admin` for handlers to use.
 */
export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: AUTH_REQUIRED });
    return;
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ success: false, message: SESSION_EXPIRED });
    return;
  }

  req.admin = { ...payload, adminId: payload.sub };
  next();
}

// ----------------------------------------------------
// LOGIN THROTTLING
// ----------------------------------------------------

/**
 * Failed-attempt tracker for the login endpoint.
 *
 * Deliberately dependency-free: a Map keyed by client address is enough to slow
 * password guessing for a single-admin dashboard. In-memory state resets on
 * restart, which is acceptable here and keeps the surface small — a multi-node
 * deployment would move this to shared storage.
 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const loginFailures = new Map<string, { count: number; firstAt: number }>();

/** Number of failed attempts currently recorded for an address. */
export function loginFailureCount(key: string): number {
  const entry = loginFailures.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginFailures.delete(key);
    return 0;
  }
  return entry.count;
}

/** Register a failed attempt and return the running total. */
export function recordLoginFailure(key: string): number {
  const existing = loginFailures.get(key);
  if (!existing || Date.now() - existing.firstAt > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, firstAt: Date.now() });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

/** Clear the counter after a successful sign-in. */
export function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}

/** Seconds the client should wait before retrying, or 0 when not throttled. */
export function loginRetryAfterSeconds(key: string): number {
  const remaining = MAX_ATTEMPTS - loginFailureCount(key);
  if (remaining > 0) return 0;
  const entry = loginFailures.get(key);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.firstAt;
  return Math.max(1, Math.ceil((LOGIN_WINDOW_MS - elapsed) / 1000));
}

/** Record a successful sign-in so the dashboard can show the last login time. */
export async function touchAdminLogin(adminId: string): Promise<void> {
  try {
    await prisma.adminUser.update({
      where: { id: adminId },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    // A failed audit write must not block an otherwise valid sign-in.
  }
}