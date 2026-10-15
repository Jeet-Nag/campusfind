import { signal } from '@preact/signals';
import { ApiResponse, User } from '@shared';
import { authToken, handleSessionExpired } from './auth';

export type AdminTab = 'dashboard' | 'providers' | 'bookings' | 'users';

export const adminActiveTab = signal<AdminTab>('dashboard');
export const isAdminLoading = signal<boolean>(false);
export const adminError = signal<string | null>(null);

export function setAdminTab(tab: AdminTab): void {
  adminActiveTab.value = tab;
}

/**
 * Validates the admin session against GET /api/admin/me.
 * Enforces server-authoritative role verification.
 */
export async function verifyAdminSession(): Promise<boolean> {
  const token = authToken.value;
  if (!token) {
    return false;
  }

  isAdminLoading.value = true;
  adminError.value = null;

  try {
    const res = await fetch('/api/admin/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    if (res.status === 403) {
      adminError.value = 'ACCESS_DENIED';
      return false;
    }

    if (!res.ok) {
      adminError.value = 'LOAD_ERROR';
      return false;
    }

    const body: ApiResponse<{ user: User }> = await res.json();
    if (!body.success) {
      adminError.value = 'LOAD_ERROR';
      return false;
    }

    return true;
  } catch {
    adminError.value = 'NETWORK_ERROR';
    return false;
  } finally {
    isAdminLoading.value = false;
  }
}
