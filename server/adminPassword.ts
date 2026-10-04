/**
 * Password hashing for admin accounts.
 *
 * Shared by the seed script and the API so a password created at seed time is
 * always verifiable at login time. Plain-text passwords are never persisted —
 * only the bcrypt digest produced here is written to the database.
 *
 * bcryptjs (pure JavaScript) is used instead of the native `bcrypt` binding so
 * the project installs and runs without a compiler toolchain.
 */

import bcrypt from 'bcryptjs';

/** Cost factor: ~10 rounds, a reasonable work factor for an admin login. */
const SALT_ROUNDS = 10;

/** Hash a plain-text password for storage. */
export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Compare a candidate password against a stored digest.
 *
 * Returns false rather than throwing on a malformed or missing digest so a
 * corrupt row can never be turned into an authentication bypass.
 */
export async function verifyPassword(
  plainText: string,
  passwordHash: string | null | undefined
): Promise<boolean> {
  if (!plainText || !passwordHash) return false;
  try {
    return await bcrypt.compare(plainText, passwordHash);
  } catch {
    return false;
  }
}