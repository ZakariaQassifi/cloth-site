/**
 * Runtime configuration — the single place where the frontend learns where its
 * backend lives. Point `VITE_API_BASE_URL` at a different host to move the
 * frontend between local, staging and production without touching any code.
 */

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export const API_BASE_URL = trimTrailingSlash(
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.trim() || DEFAULT_API_BASE_URL
);

export const REQUEST_TIMEOUT_MS = 15000;