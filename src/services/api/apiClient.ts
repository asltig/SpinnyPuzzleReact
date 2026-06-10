/**
 * apiClient.ts
 * Axios instance matching the original MDWebServiceManager behavior exactly.
 *
 * Key findings from server analysis (2026-06-04):
 *  • Server: https://bluger.ch/puzzle/api/  (HTTP 301 redirects to HTTPS)
 *  • Protocol: MUST use HTTPS — Axios does not follow 301 redirects on POST
 *  • Content-Type: application/x-www-form-urlencoded  (AFNetworking default in ObjC)
 *    The server does NOT accept JSON bodies.
 *  • Images base URL: https://bluger.ch/puzzle/  (ObjC: apiImgUrl)
 *    Level image paths are relative: "uploads/levels/l6_bg_image.jpg"
 *    Full URL = IMG_BASE_URL + path
 *
 * Interceptors:
 *  - Inject userID into every request body (ObjC: params[@"user"] = self.userID)
 *  - Queue failed requests for retry when back online
 */
import axios from 'axios';
import { retryQueue } from './retryQueue';
import { getUserId } from '../../storage/settingsStorage';

// ObjC apiUrl (HTTPS enforced — server 301s HTTP):
export const API_BASE_URL = process.env.API_BASE_URL ?? 'https://bluger.ch/puzzle/api';
// ObjC apiImgUrl — prepend to relative image paths from server:
export const IMG_BASE_URL  = 'https://bluger.ch/puzzle/';

/** Build a full image URL from a server-relative path (e.g. "uploads/levels/l6_bg_image.jpg") */
export function fullImgUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return IMG_BASE_URL + path;
}

export const apiClient = axios.create({
  baseURL:  API_BASE_URL,
  timeout:  15_000,
  headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },

  // ObjC uses AFNetworking which sends NSDictionary as form-encoded by default.
  // We replicate that here: convert plain objects to URLSearchParams strings.
  transformRequest: [
    (data: unknown) => {
      if (data && typeof data === 'object') {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
          params.append(key, String(value ?? ''));
        }
        return params.toString();
      }
      return data;
    },
  ],
});

// ─── Request interceptor — inject userID ──────────────────────────────────────
// ObjC: params[@"user"] = self.userID  in AppManager
apiClient.interceptors.request.use((config) => {
  const userId = getUserId();
  if (userId && config.data && typeof config.data === 'object') {
    config.data = { ...(config.data as object), user: userId };
  }
  return config;
});

// ─── Response interceptor — queue failed requests ─────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config;
    if (config && !config._retried && error.code === 'ERR_NETWORK') {
      retryQueue.enqueue({ method: config.method, url: config.url, data: config.data });
    }
    return Promise.reject(error);
  },
);