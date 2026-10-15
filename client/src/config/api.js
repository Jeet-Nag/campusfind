import { Capacitor } from '@capacitor/core';
/**
 * Resolves the native API base URL based on build-time environment flags.
 * - Staging: Explicitly configured via VITE_API_BASE_URL (e.g. https://chandil-home-services-staging.onrender.com)
 * - Production: Explicitly configured via VITE_API_BASE_URL (e.g. https://chandilhomeservices.devs.surf)
 * - Local Development: Falls back to http://127.0.0.1:3000 for ADB reverse proxying.
 *
 * SAFETY INVARIANT: A release build of native Android must NEVER silently fall back
 * to production or localhost if unconfigured. If VITE_API_BASE_URL is missing in a release
 * build, it returns an unconfigured diagnostic sentinel to prevent accidental requests.
 */
export function resolveNativeApiBaseUrl(customEnv) {
    const env = customEnv || import.meta.env || {};
    const explicitUrl = env.VITE_API_BASE_URL ? String(env.VITE_API_BASE_URL).trim() : '';
    if (explicitUrl.length > 0) {
        return explicitUrl.replace(/\/+$/, '');
    }
    // Local development fallback (only when NOT in production build mode)
    if (!env.PROD || env.DEV) {
        return 'http://127.0.0.1:3000';
    }
    // Release/production build with missing API URL must fail safely
    const warning = '[API Config Error] VITE_API_BASE_URL is not set for native release build. Build must explicitly specify target endpoint.';
    if (typeof console !== 'undefined' && console.error) {
        console.error(warning);
    }
    return 'UNCONFIGURED_NATIVE_API_BASE_URL';
}
/**
 * Centralized API base URL configuration.
 * - In Web Browser / Production: empty string (requests use standard relative /api/... paths)
 * - In Capacitor Native Android: dynamically resolved via resolveNativeApiBaseUrl()
 */
export const API_BASE_URL = Capacitor.isNativePlatform()
    ? resolveNativeApiBaseUrl()
    : '';
/**
 * Resolves an API path using the centralized API_BASE_URL.
 */
export function getApiUrl(path, customBaseUrl) {
    const baseUrl = customBaseUrl !== undefined ? customBaseUrl : API_BASE_URL;
    if (baseUrl === 'UNCONFIGURED_NATIVE_API_BASE_URL') {
        throw new Error('API Base URL is unconfigured for native build. Build must specify an explicit VITE_API_BASE_URL.');
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
}
/**
 * Installs a global fetch interceptor to automatically route all relative /api/... requests
 * through getApiUrl() across the application without manual per-fetch modifications.
 */
export function initApiInterceptor() {
    if (typeof window === 'undefined' || !window.fetch)
        return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
        try {
            if (typeof input === 'string') {
                if (input.startsWith('/api/') || input === '/api') {
                    return await originalFetch(getApiUrl(input), init);
                }
            }
            else if (input instanceof URL) {
                if (input.pathname.startsWith('/api/') && input.origin === window.location.origin) {
                    return await originalFetch(getApiUrl(input.pathname + input.search), init);
                }
            }
            else if (input instanceof Request) {
                const urlStr = input.url;
                if (urlStr.startsWith('/api/')) {
                    const newRequest = new Request(getApiUrl(urlStr), input);
                    return await originalFetch(newRequest, init);
                }
                else if (urlStr.startsWith(window.location.origin + '/api/')) {
                    const path = urlStr.replace(window.location.origin, '');
                    const newRequest = new Request(getApiUrl(path), input);
                    return await originalFetch(newRequest, init);
                }
            }
        }
        catch {
            // Fall through to original fetch on any inspection issue
        }
        return originalFetch(input, init);
    };
}
