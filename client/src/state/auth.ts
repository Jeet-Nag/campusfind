import { signal, computed } from '@preact/signals';
import { User, ApiResponse } from '@shared';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { currentLanguage, selectLanguage } from './language';

export interface PasskeyBridgePlugin {
  isSupported(): Promise<{ isSupported: boolean }>;
  createCredential(options: { requestJson: string }): Promise<{ responseJson: string }>;
  getCredential(options: { requestJson: string }): Promise<{ responseJson: string }>;
}

export const PasskeyBridge = registerPlugin<PasskeyBridgePlugin>('PasskeyBridge');

const TOKEN_KEY = 'chandil_token';
const USER_KEY = 'chandil_user';
export const REGISTERED_HINT_KEY = 'chandil_has_passkey';

function getInitialToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getInitialUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Determines initial auth mode for UX layout.
 * - First-time user (no session & no client registration hint): default to 'register' (Create Passkey)
 * - Returning user (has session or previously registered on this client): default to 'login' (Sign in with Passkey)
 * Note: this is strictly a client UX layout hint; backend remains authoritative for all authentication.
 */
export function getInitialAuthMode(): 'login' | 'register' {
  try {
    if (localStorage.getItem(REGISTERED_HINT_KEY) === 'true' || localStorage.getItem(TOKEN_KEY)) {
      return 'login';
    }
  } catch {
    // LocalStorage restricted or unavailable
  }
  return 'register';
}

export const authToken = signal<string | null>(getInitialToken());
export const currentUser = signal<User | null>(getInitialUser());

export const isAuthenticated = computed(() => !!authToken.value && !!currentUser.value);

export type OnboardingRole = 'customer' | 'worker';
export const selectedOnboardingRole = signal<OnboardingRole | null>(null);

export const authMode = signal<'login' | 'register'>(getInitialAuthMode());
export const phoneInput = signal<string>('');
export const fullNameInput = signal<string>('');
export const authLoading = signal<boolean>(false);
export const authError = signal<string | null>(null);
export const authCancelled = signal<boolean>(false);

/**
 * Initiates WebAuthn login ceremony via Passkey.
 * If phoneHint is provided, it is sent to /api/auth/passkey/login-options as an account lookup hint.
 * If omitted/empty, discoverable credentials ceremony is initiated.
 */
export async function loginWithPasskey(phoneHint?: string): Promise<boolean> {
  authLoading.value = true;
  authError.value = null;
  authCancelled.value = false;

  const phone = (phoneHint !== undefined ? phoneHint : phoneInput.value).trim();
  const requestBody: { phone?: string } = {};
  if (phone && /^[6-9]\d{9}$/.test(phone)) {
    requestBody.phone = phone;
  }

  try {
    // 1. Fetch authentication options from backend
    const optionsRes = await fetch('/api/auth/passkey/login-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const optionsData: ApiResponse<any> = await optionsRes.json();
    if (!optionsRes.ok || !optionsData.success || !optionsData.data) {
      authError.value = currentLanguage.value === 'hi'
        ? (optionsData.error?.messageHi || 'लॉगिन विकल्प प्राप्त करने में विफल। कृपया पुनः प्रयास करें।')
        : (optionsData.error?.messageEn || 'Failed to get login options. Please try again.');
      return false;
    }

    // 2. Perform WebAuthn authentication ceremony (native Credential Manager if Android app, otherwise WebAuthn browser API)
    let authResponse;
    try {
      if (Capacitor.isNativePlatform()) {
        const bridgeResult = await PasskeyBridge.getCredential({
          requestJson: JSON.stringify(optionsData.data),
        });
        authResponse = JSON.parse(bridgeResult.responseJson);
      } else {
        authResponse = await startAuthentication({ optionsJSON: optionsData.data });
      }
    } catch (err: any) {
      const errCode = err.code || err.message;
      if (err.name === 'NotAllowedError' || errCode === 'CANCELLATION' || errCode === 'USER_ABORT') {
        authCancelled.value = true;
        authError.value = currentLanguage.value === 'hi'
          ? 'पासकी सत्यापन रद्द किया गया। पुनः प्रयास करने के लिए नीचे टैप करें।'
          : 'Passkey prompt was cancelled. Tap below to retry.';
      } else if (err.name === 'InvalidStateError' || err.name === 'NotFoundError' || errCode === 'NO_CREDENTIAL') {
        authError.value = currentLanguage.value === 'hi'
          ? 'इस डिवाइस पर कोई पासकी नहीं मिली। कृपया पहले पासकी बनाएं।'
          : 'No passkey found on this device. Please create a passkey first.';
      } else if (err.name === 'NotSupportedError' || errCode === 'UNSUPPORTED') {
        authError.value = currentLanguage.value === 'hi'
          ? 'यह ब्राउज़र या डिवाइस पासकी का समर्थन नहीं करता है।'
          : 'Passkeys are not supported on this browser or device.';
      } else {
        authError.value = currentLanguage.value === 'hi'
          ? (err.message || 'पासकी सत्यापन विफल रहा। कृपया पुनः प्रयास करें।')
          : (err.message || 'Passkey authentication failed. Please try again.');
      }
      return false;
    }

    // 3. Verify assertion with backend
    const verifyRes = await fetch('/api/auth/passkey/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: authResponse }),
    });

    const verifyData: ApiResponse<{ token: string; user: User }> = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success || !verifyData.data) {
      authError.value = currentLanguage.value === 'hi'
        ? (verifyData.error?.messageHi || 'पासकी सत्यापन विफल रहा। कृपया पुनः प्रयास करें।')
        : (verifyData.error?.messageEn || 'Passkey verification failed. Please try again.');
      return false;
    }

    const { token, user } = verifyData.data;
    authToken.value = token;
    currentUser.value = user;

    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(REGISTERED_HINT_KEY, 'true');
    } catch {
      // Ignore localStorage quotas
    }

    if (user.preferredLanguage && user.preferredLanguage !== currentLanguage.value) {
      selectLanguage(user.preferredLanguage);
    }

    phoneInput.value = '';
    fullNameInput.value = '';
    authError.value = null;
    authCancelled.value = false;
    return true;
  } catch {
    authError.value = currentLanguage.value === 'hi'
      ? 'नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन जांचें।'
      : 'Network error. Please check your internet connection.';
    return false;
  } finally {
    authLoading.value = false;
  }
}

/**
 * Initiates WebAuthn registration ceremony via Passkey.
 * Collects 10-digit mobile number, optional full name, and preferred language.
 */
export async function registerPasskey(
  customPhone?: string,
  customName?: string,
  customFlow?: 'customer' | 'worker'
): Promise<boolean> {
  const phone = (customPhone !== undefined ? customPhone : phoneInput.value).trim();
  const fullName = (customName !== undefined ? customName : fullNameInput.value).trim();
  const roleFlow = customFlow !== undefined ? customFlow : (selectedOnboardingRole.value || undefined);

  if (!/^[6-9]\d{9}$/.test(phone)) {
    authError.value = currentLanguage.value === 'hi'
      ? 'कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।'
      : 'Please enter a valid 10-digit mobile number.';
    return false;
  }

  // Customer full name is strictly required
  if (roleFlow === 'customer' && !fullName) {
    authError.value = currentLanguage.value === 'hi'
      ? 'कृपया अपना पूरा नाम दर्ज करें।'
      : 'Please enter your full name.';
    return false;
  }

  authLoading.value = true;
  authError.value = null;
  authCancelled.value = false;

  try {
    // 1. Fetch creation options from backend
    const optionsRes = await fetch('/api/auth/passkey/register-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        fullName: fullName || undefined,
        preferredLanguage: currentLanguage.value || 'hi',
        flow: roleFlow,
      }),
    });

    const optionsData: ApiResponse<any> = await optionsRes.json();
    if (!optionsRes.ok || !optionsData.success || !optionsData.data) {
      authError.value = currentLanguage.value === 'hi'
        ? (optionsData.error?.messageHi || 'पंजीकरण विकल्प प्राप्त करने में विफल। कृपया पुनः प्रयास करें।')
        : (optionsData.error?.messageEn || 'Failed to get registration options. Please try again.');
      return false;
    }

    // 2. Perform WebAuthn registration ceremony (native Credential Manager if Android app, otherwise WebAuthn browser API)
    let regResponse;
    try {
      if (Capacitor.isNativePlatform()) {
        const bridgeResult = await PasskeyBridge.createCredential({
          requestJson: JSON.stringify(optionsData.data),
        });
        regResponse = JSON.parse(bridgeResult.responseJson);
      } else {
        regResponse = await startRegistration({ optionsJSON: optionsData.data });
      }
    } catch (err: any) {
      const errCode = err.code || err.message;
      if (err.name === 'NotAllowedError' || errCode === 'CANCELLATION' || errCode === 'USER_ABORT') {
        authCancelled.value = true;
        authError.value = currentLanguage.value === 'hi'
          ? 'पासकी निर्माण रद्द किया गया। पुनः प्रयास करने के लिए नीचे टैप करें।'
          : 'Passkey creation was cancelled. Tap below to retry.';
      } else if (err.name === 'InvalidStateError') {
        authError.value = currentLanguage.value === 'hi'
          ? 'इस डिवाइस पर पहले से पासकी मौजूद है। कृपया लॉगिन करें।'
          : 'A passkey already exists on this device. Please sign in.';
      } else if (err.name === 'NotSupportedError' || errCode === 'UNSUPPORTED') {
        authError.value = currentLanguage.value === 'hi'
          ? 'यह ब्राउज़र या डिवाइस पासकी का समर्थन नहीं करता है।'
          : 'Passkeys are not supported on this browser or device.';
      } else {
        authError.value = currentLanguage.value === 'hi'
          ? (err.message || 'पासकी निर्माण विफल रहा। कृपया पुनः प्रयास करें।')
          : (err.message || 'Passkey creation failed. Please try again.');
      }
      return false;
    }

    // 3. Verify attestation with backend
    const verifyRes = await fetch('/api/auth/passkey/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        response: regResponse,
        fullName: fullName || undefined,
        preferredLanguage: currentLanguage.value || 'hi',
        flow: roleFlow,
      }),
    });

    const verifyData: ApiResponse<{ token: string; user: User; isNewUser: boolean }> = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success || !verifyData.data) {
      authError.value = currentLanguage.value === 'hi'
        ? (verifyData.error?.messageHi || 'पासकी पंजीकरण सत्यापन विफल रहा। कृपया पुनः प्रयास करें।')
        : (verifyData.error?.messageEn || 'Passkey registration verification failed. Please try again.');
      return false;
    }

    const { token, user } = verifyData.data;
    authToken.value = token;
    currentUser.value = user;

    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(REGISTERED_HINT_KEY, 'true');
    } catch {
      // Ignore localStorage quotas
    }

    if (user.preferredLanguage && user.preferredLanguage !== currentLanguage.value) {
      selectLanguage(user.preferredLanguage);
    }

    phoneInput.value = '';
    fullNameInput.value = '';
    authError.value = null;
    authCancelled.value = false;
    authLoading.value = false;
    authMode.value = 'login';
    return true;
  } catch {
    authError.value = currentLanguage.value === 'hi'
      ? 'नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन जांचें।'
      : 'Network error. Please check your internet connection.';
    return false;
  } finally {
    authLoading.value = false;
  }
}

/**
 * Validates active session against /api/auth/me to verify tokenVersion and refresh authoritative user profile.
 */
export async function refreshSession(): Promise<boolean> {
  const token = authToken.value;
  if (!token) return false;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }
    const body: ApiResponse<{ user: User }> = await res.json();
    if (res.ok && body.success && body.data?.user) {
      currentUser.value = body.data.user;
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(body.data.user));
      } catch {
        // Ignore
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Clears local credentials and notifies backend to invalidate token version.
 */
export async function logout(): Promise<void> {
  const token = authToken.value;
  authToken.value = null;
  currentUser.value = null;
  selectedOnboardingRole.value = null;
  authMode.value = 'login';
  phoneInput.value = '';
  fullNameInput.value = '';
  authError.value = null;
  authCancelled.value = false;
  authLoading.value = false;

  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore localStorage errors
  }

  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Best-effort logout notification
    }
  }
}

/**
 * Handles server-side 401 Unauthorized or expired tokenVersion.
 */
export function handleSessionExpired(): void {
  authToken.value = null;
  currentUser.value = null;
  selectedOnboardingRole.value = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore localStorage errors
  }
  authMode.value = 'login';
  authLoading.value = false;
  authCancelled.value = false;
  authError.value = currentLanguage.value === 'hi'
    ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
    : 'Session expired. Please log in again.';
}
