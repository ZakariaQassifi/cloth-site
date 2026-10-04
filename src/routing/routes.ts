/**
 * Client-side routing.
 *
 * The storefront keeps URL-driven navigation (so category and collection pages
 * are linkable and survive a refresh) while view state that has no public page
 * of its own — product detail, checkout, order confirmation — is addressed via
 * explicit paths too, so browser Back behaves correctly.
 */

import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'category'; category: string }
  | { name: 'sale' }
  | { name: 'new' }
  | { name: 'product'; productId: string }
  | { name: 'checkout' }
  | { name: 'order-confirmation' }
  | { name: 'wishlist' }
  | { name: 'admin' }
  | { name: 'admin-login' }
  | { name: 'not-found' };

export const HOME_ROUTE: Route = { name: 'home' };

/** Path the admin guard redirects to when no valid session exists. */
export const ADMIN_LOGIN_PATH = '/admin/login';

export function slugifyCategory(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/** Reverse of `slugifyCategory`, used when resolving a category from a URL. */
export function categoryFromSlug(slug: string): string {
  const decoded = decodeURIComponent(slug);
  return decoded.charAt(0).toUpperCase() + decoded.slice(1).replace(/-/g, ' ');
}

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/admin') return { name: 'admin' };
  if (path === '/admin/login') return { name: 'admin-login' };
  if (path === '/sale') return { name: 'sale' };
  if (path === '/new-arrivals') return { name: 'new' };
  if (path === '/checkout') return { name: 'checkout' };
  if (path === '/order-confirmation') return { name: 'order-confirmation' };
  if (path === '/wishlist') return { name: 'wishlist' };
  if (path === '/') return { name: 'home' };

  const productMatch = path.match(/^\/product\/([^/]+)$/);
  if (productMatch) return { name: 'product', productId: decodeURIComponent(productMatch[1]) };

  const categoryMatch = path.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) return { name: 'category', category: categoryFromSlug(categoryMatch[1]) };

  // Legacy flat category paths such as /men or /t-shirts.
  if (!path.includes('/')) return { name: 'category', category: categoryFromSlug(path.slice(1)) };

  return { name: 'not-found' };
}

export function buildPath(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'admin':
      return '/admin';
    case 'admin-login':
      return ADMIN_LOGIN_PATH;
    case 'sale':
      return '/sale';
    case 'new':
      return '/new-arrivals';
    case 'checkout':
      return '/checkout';
    case 'order-confirmation':
      return '/order-confirmation';
    case 'wishlist':
      return '/wishlist';
    case 'product':
      return `/product/${encodeURIComponent(route.productId)}`;
    case 'category':
      return `/category/${encodeURIComponent(slugifyCategory(route.category))}`;
    default:
      return '/';
  }
}

const NAVIGATION_EVENT = 'kinetic:navigate';

function subscribe(callback: () => void): () => void {
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATION_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATION_EVENT, callback);
  };
}

function getSnapshot(): string {
  return window.location.pathname;
}

/** Navigate without a full page reload. */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (target === getSnapshot()) return;

  if (options.replace) {
    window.history.replaceState({}, '', target);
  } else {
    window.history.pushState({}, '', target);
  }
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

/** Current route, kept in sync with the address bar. */
export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, getSnapshot, () => '/');
  return parseRoute(pathname);
}

export function navigateToHome(): void {
  navigate('/');
}