/**
 * The single HTTP boundary between the UI and the backend.
 *
 * Every service funnels through `request`, so timeouts, JSON handling, error
 * normalisation and the `ApiResult` envelope are implemented exactly once.
 * Swapping REST for GraphQL, or the backend for a local fixture, only requires
 * changing this file and the service modules.
 */

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/env';
import { apiErrorMessage, type ApiResult } from '../types/api';

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: object;
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Extra headers, used by the admin layer to send the session token.
   * Storefront calls omit this entirely and stay anonymous.
   */
  headers?: Record<string, string>;
}

export function buildQueryString(params: object): string {
  const search = new URLSearchParams();
  Object.entries(params as Record<string, QueryValue>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isApiEnvelope(body: unknown): body is ApiResult<unknown> {
  return !!body && typeof body === 'object' && 'success' in (body as Record<string, unknown>);
}

/**
 * Perform a request and always resolve to an `ApiResult`.
 * Never throws, so callers cannot accidentally break rendering on a network
 * error — they receive `{ success: false, message }` instead.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {
  const { method = 'GET', query, body, signal, headers } = options;

  // ✅ Ensure all relative paths include /api/ prefix
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPath = cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;

  const url = `${API_BASE_URL}${normalizedPath}${query ? buildQueryString(query) : ''}`;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort());

  // JSON bodies set their own content type; multipart uploads must not.
  const requestHeaders: Record<string, string> = { ...headers };
  if (body !== undefined && !headers?.['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      ...(Object.keys(requestHeaders).length > 0 && { headers: requestHeaders }),
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    const payload = await parseBody(response);

    if (isApiEnvelope(payload)) {
      if (payload.success && response.ok) return payload as ApiResult<T>;
      return {
        success: false,
        message: payload.message || `Request failed with status ${response.status}`,
      };
    }

    if (!response.ok) {
      return { success: false, message: `Request failed with status ${response.status}` };
    }

    // Endpoint returned a bare payload rather than the standard envelope.
    return { success: true, message: 'OK', data: payload as T };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return {
      success: false,
      message: aborted
        ? 'The server took too long to respond. Please try again.'
        : apiErrorMessage(error, 'Unable to reach the server. Please try again.'),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** Multipart upload used for product and category images. */
export async function uploadFiles(
  path: string,
  files: File[],
  fieldName = 'images',
  headers: Record<string, string> = {}
): Promise<ApiResult<string[]>> {
  const formData = new FormData();
  files.forEach((file) => formData.append(fieldName, file));

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPath = cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;

  try {
    const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
      method: 'POST',
      // No Content-Type here: the browser must set the multipart boundary.
      ...(Object.keys(headers).length > 0 && { headers }),
      body: formData,
    });
    const payload = await parseBody(response);
    if (isApiEnvelope(payload) && payload.success) return payload as ApiResult<string[]>;
    return {
      success: false,
      message: isApiEnvelope(payload) ? payload.message : 'Image upload failed.',
    };
  } catch (error) {
    return { success: false, message: apiErrorMessage(error, 'Image upload failed.') };
  }
}