/**
 * Admin session state for the browser.
 *
 * The signed session token issued by the API is kept in localStorage so the
 * admin stays signed in across a reload. This module is only the client-side
 * half of the story: the API independently verifies the token on every admin
 * request, so clearing or forging this value cannot grant access.
 *
 * A tiny subscribe/notify store lets React re-render when the session changes,
 * which is how the dashboard reacts to a token rejected mid-session.
 */

import { useSyncExternalStore } from 'react';

const TOKEN_STORAGE_KEY = 'kinetic_admin_token';
const PROFILE_STORAGE_KEY = 'kinetic_admin_profile';

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AdminSession {
  token: string;
  admin: AdminProfile;
}

const SESSION_CHANGE_EVENT = 'kinetic:admin-session';

/** Cached so repeated reads avoid hitting localStorage on every render. */
let cachedToken: string | null = null;
let cachedProfile: AdminProfile | null = null;
let cacheLoaded = false;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing modes can throw; treat that as "no session".
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the session simply will not survive a reload.
  }
}

function loadCache(): void {
  if (cacheLoaded) return;
  cacheLoaded = true;
  const rawToken = readStorage(TOKEN_STORAGE_KEY);
  const rawProfile = readStorage(PROFILE_STORAGE_KEY);

  cachedToken = rawToken;
  if (rawToken && rawProfile) {
    try {
      cachedProfile = JSON.parse(rawProfile) as AdminProfile;
    } catch {
      // Profile unreadable — drop both halves rather than trust a bare token.
      cachedToken = null;
      cachedProfile = null;
    }
  } else if (rawToken && !rawProfile) {
    // Token without a profile is a half-written session; discard it.
    cachedToken = null;
    cachedProfile = null;
  }

  if (cachedToken === null) {
    writeStorage(TOKEN_STORAGE_KEY, null);
    writeStorage(PROFILE_STORAGE_KEY, null);
  }
}

function notifySessionChanged(): void {
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

/**
 * Invalidate the cache and notify, then let subscribers re-read.
 *
 * Re-reading matters for the `storage` case: that event only fires in *other*
 * tabs, so a sign-out performed elsewhere would otherwise leave this tab
 * rendering a stale "signed in" dashboard on a token that is already gone.
 */
function invalidateCacheAndNotify(): void {
  cacheLoaded = false;
  cachedToken = null;
  cachedProfile = null;
  loadCache();
  notifySessionChanged();
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(SESSION_CHANGE_EVENT, callback);

  const onStorage = (event: StorageEvent) => {
    // `key === null` means storage was cleared wholesale.
    if (
      event.key === null ||
      event.key === TOKEN_STORAGE_KEY ||
      event.key === PROFILE_STORAGE_KEY
    ) {
      invalidateCacheAndNotify();
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/** True when a token is held. The API still verifies it before granting access. */
function sessionSnapshot(): boolean {
  loadCache();
  return cachedToken !== null;
}

function serverSnapshot(): boolean {
  return false;
}

/** Reactive read of the session flag, safe to use during render. */
export function useAdminAuthenticated(): boolean {
  return useSyncExternalStore(subscribe, sessionSnapshot, serverSnapshot);
}

/** Reactive read of the token itself, so the guard can re-check on change. */
export function useAdminToken(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      loadCache();
      return cachedToken;
    },
    () => null
  );
}

export function getAdminToken(): string | null {
  loadCache();
  return cachedToken;
}

export function getAdminProfile(): AdminProfile | null {
  loadCache();
  return cachedProfile;
}

export function isAdminAuthenticated(): boolean {
  return getAdminToken() !== null;
}

/** Record a successful sign-in. */
export function startAdminSession(session: AdminSession): void {
  cacheLoaded = true;
  cachedToken = session.token;
  cachedProfile = session.admin;
  writeStorage(TOKEN_STORAGE_KEY, session.token);
  writeStorage(PROFILE_STORAGE_KEY, JSON.stringify(session.admin));
  notifySessionChanged();
}

/** Discard the session. Safe to call when already signed out. */
export function clearAdminSession(): void {
  cacheLoaded = true;
  cachedToken = null;
  cachedProfile = null;
  writeStorage(TOKEN_STORAGE_KEY, null);
  writeStorage(PROFILE_STORAGE_KEY, null);
  notifySessionChanged();
}

/**
 * Authorization header for admin requests, or an empty object when signed out.
 *
 * Used by the admin service layer only — storefront requests stay anonymous so
 * this change cannot affect public pages.
 */
export function adminAuthHeader(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}