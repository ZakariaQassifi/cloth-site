/**
 * Message constants shared by the API and the browser.
 *
 * The admin client decides what to do with a failure (clear the session, show a
 * throttle notice, fall back to a generic message) by matching these exact
 * strings. Keeping them in one dependency-free module means the server and the
 * client cannot drift apart, and avoids matching on fragile substrings.
 *
 * This file must stay free of imports so both `tsx server.ts` and the Vite
 * bundle can load it.
 */

/** No `Authorization` header was supplied. */
export const AUTH_REQUIRED = 'Authentication required. Please sign in.';

/** A token was supplied but is expired, tampered, or otherwise unusable. */
export const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

/**
 * Returned for both an unknown address and a wrong password so the endpoint
 * cannot be used to discover which admin accounts exist.
 */
export const INVALID_CREDENTIALS = 'Invalid email or password.';

/** The request body was missing an email or password. */
export const MISSING_CREDENTIALS = 'Email and password are required.';

/** Too many failed attempts in the current window. */
export const TOO_MANY_ATTEMPTS = 'Too many failed sign-in attempts. Please wait a few minutes and try again.';