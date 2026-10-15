import { signal, computed } from '@preact/signals';
import { ApiResponse, AdminUserView, TestCleanupPreview, TestCleanupResult } from '@shared';
import { authToken, handleSessionExpired } from './auth';

// User list & loading state
export const usersList = signal<AdminUserView[]>([]);
export const isUsersLoading = signal<boolean>(false);
export const usersError = signal<string | null>(null);
export const usersSuccessMessage = signal<string | null>(null);

// Search & Filter state
export const userSearchQuery = signal<string>('');
export const userRoleFilter = signal<'all' | 'customer' | 'provider' | 'admin'>('all');
export const userStatusFilter = signal<'all' | 'active' | 'inactive'>('all');
export const userTestFilter = signal<'all' | 'test' | 'real'>('all');

// Computed filtered list
export const filteredUsers = computed(() => {
  const query = userSearchQuery.value.trim().toLowerCase();
  const role = userRoleFilter.value;
  const status = userStatusFilter.value;
  const testFilter = userTestFilter.value;

  return usersList.value.filter((u) => {
    // Role filter
    if (role !== 'all' && u.role !== role) {
      return false;
    }

    // Status filter
    if (status === 'active' && !u.isActive) {
      return false;
    }
    if (status === 'inactive' && u.isActive) {
      return false;
    }

    // Test data filter
    if (testFilter === 'test' && !u.isTest) {
      return false;
    }
    if (testFilter === 'real' && u.isTest) {
      return false;
    }

    // Search query filter
    if (query.length > 0) {
      const matchPhone = u.phone.toLowerCase().includes(query);
      const matchName = (u.fullName || '').toLowerCase().includes(query);
      if (!matchPhone && !matchName) {
        return false;
      }
    }

    return true;
  });
});

// Deactivation Modal state
export const deactivatingUser = signal<AdminUserView | null>(null);
export const isDeactivatingUser = signal<boolean>(false);
export const deactivateUserError = signal<string | null>(null);

// Permanent Deletion Modal state
export const deletingUser = signal<AdminUserView | null>(null);
export const deletePhoneInput = signal<string>('');
export const isDeletingUser = signal<boolean>(false);
export const deleteUserError = signal<string | null>(null);

// Test Marking state
export const markingUserId = signal<string | null>(null);
export const markingTestUser = signal<AdminUserView | null>(null);
export const markTestError = signal<string | null>(null);

// Test Data Cleanup state
export const isCleanupModalOpen = signal<boolean>(false);
export const cleanupPreview = signal<TestCleanupPreview | null>(null);
export const isLoadingCleanupPreview = signal<boolean>(false);
export const cleanupConfirmInput = signal<string>('');
export const isExecutingCleanup = signal<boolean>(false);
export const cleanupError = signal<string | null>(null);

export function clearUserSuccessMessage(): void {
  usersSuccessMessage.value = null;
}

/**
 * Fetches all registered users from the administrative API.
 */
export async function fetchAdminUsers(): Promise<void> {
  const token = authToken.value;
  if (!token) return;

  isUsersLoading.value = true;
  usersError.value = null;

  try {
    const res = await fetch('/api/admin/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    if (!res.ok) {
      usersError.value = 'LOAD_ERROR';
      return;
    }

    const body: ApiResponse<{ users: AdminUserView[] }> = await res.json();
    if (!body.success || !body.data) {
      usersError.value = 'LOAD_ERROR';
      return;
    }

    usersList.value = body.data.users;
  } catch {
    usersError.value = 'NETWORK_ERROR';
  } finally {
    isUsersLoading.value = false;
  }
}

/**
 * Toggles a user's active/inactive status.
 */
export async function toggleUserStatus(user: AdminUserView, isActive: boolean): Promise<boolean> {
  const token = authToken.value;
  if (!token) return false;

  try {
    const res = await fetch(`/api/admin/users/${user.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{ user: AdminUserView }> = await res.json();
    if (!body.success || !body.data) {
      return false;
    }

    // Update in-memory list
    usersList.value = usersList.value.map((u) => (u.id === user.id ? body.data!.user : u));
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggles whether a user is flagged as test data.
 */
export async function toggleUserTestMark(user: AdminUserView): Promise<boolean> {
  const token = authToken.value;
  if (!token) return false;

  markingUserId.value = user.id;

  try {
    const res = await fetch(`/api/admin/users/${user.id}/mark-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isTest: !user.isTest, cascadeBookings: true }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{ user: AdminUserView }> = await res.json();
    if (!body.success || !body.data) {
      return false;
    }

    usersList.value = usersList.value.map((u) => (u.id === user.id ? body.data!.user : u));
    return true;
  } catch {
    return false;
  } finally {
    markingUserId.value = null;
  }
}

// Modal controls for Test Data Status
export function openMarkTestModal(user: AdminUserView): void {
  markingTestUser.value = user;
  markTestError.value = null;
}

export function closeMarkTestModal(): void {
  markingTestUser.value = null;
  markTestError.value = null;
}

export async function confirmToggleUserTestMark(): Promise<void> {
  const user = markingTestUser.value;
  if (!user) return;

  markTestError.value = null;
  const success = await toggleUserTestMark(user);
  if (success) {
    closeMarkTestModal();
  } else {
    markTestError.value = 'Failed to update test data status.';
  }
}

// Modal controls for Deactivation
export function openDeactivateModal(user: AdminUserView): void {
  deactivatingUser.value = user;
  deactivateUserError.value = null;
}

export function closeDeactivateModal(): void {
  deactivatingUser.value = null;
  deactivateUserError.value = null;
  isDeactivatingUser.value = false;
}

export async function confirmDeactivateUser(): Promise<void> {
  const user = deactivatingUser.value;
  if (!user) return;

  isDeactivatingUser.value = true;
  deactivateUserError.value = null;

  const success = await toggleUserStatus(user, false);
  isDeactivatingUser.value = false;

  if (success) {
    closeDeactivateModal();
  } else {
    deactivateUserError.value = 'Failed to deactivate user.';
  }
}

// Modal controls for Permanent Deletion
export function openDeleteModal(user: AdminUserView): void {
  deletingUser.value = user;
  deletePhoneInput.value = '';
  deleteUserError.value = null;
}

export function closeDeleteModal(): void {
  deletingUser.value = null;
  deletePhoneInput.value = '';
  deleteUserError.value = null;
  isDeletingUser.value = false;
}

export async function confirmDeleteUser(): Promise<boolean> {
  const user = deletingUser.value;
  const token = authToken.value;
  if (!user || !token) return false;

  if (deletePhoneInput.value.trim() !== user.phone) {
    deleteUserError.value = 'PHONE_MISMATCH';
    return false;
  }

  isDeletingUser.value = true;
  deleteUserError.value = null;

  try {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirmPhone: deletePhoneInput.value.trim() }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{ deleted: boolean; anonymized: boolean }> = await res.json();
    if (!body.success) {
      deleteUserError.value = body.error?.messageEn || 'Deletion failed.';
      return false;
    }

    // Remove user or refresh list
    usersList.value = usersList.value.filter((u) => u.id !== user.id);
    closeDeleteModal();
    return true;
  } catch {
    deleteUserError.value = 'Network error occurred during deletion.';
    return false;
  } finally {
    isDeletingUser.value = false;
  }
}

// Modal controls for Safe Test Cleanup
export async function openCleanupModal(): Promise<void> {
  isCleanupModalOpen.value = true;
  cleanupConfirmInput.value = '';
  cleanupError.value = null;
  cleanupPreview.value = null;
  await fetchCleanupPreview();
}

export function closeCleanupModal(): void {
  isCleanupModalOpen.value = false;
  cleanupConfirmInput.value = '';
  cleanupError.value = null;
  cleanupPreview.value = null;
}

export async function fetchCleanupPreview(): Promise<void> {
  const token = authToken.value;
  if (!token) return;

  isLoadingCleanupPreview.value = true;
  cleanupError.value = null;

  try {
    const res = await fetch('/api/admin/test-cleanup/preview', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    const body: ApiResponse<TestCleanupPreview> = await res.json();
    if (body.success && body.data) {
      cleanupPreview.value = body.data;
    } else {
      cleanupError.value = body.error?.messageEn || 'Failed to fetch preview.';
    }
  } catch {
    cleanupError.value = 'Network error fetching preview.';
  } finally {
    isLoadingCleanupPreview.value = false;
  }
}

export async function executeCleanup(): Promise<boolean> {
  const token = authToken.value;
  if (!token) return false;

  if (cleanupConfirmInput.value.trim() !== 'CLEANUP') {
    cleanupError.value = 'INVALID_CONFIRMATION';
    return false;
  }

  isExecutingCleanup.value = true;
  cleanupError.value = null;

  try {
    const res = await fetch('/api/admin/test-cleanup/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ confirm: 'CLEANUP' }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<TestCleanupResult> = await res.json();
    if (!body.success) {
      cleanupError.value = body.error?.messageEn || 'Cleanup failed.';
      return false;
    }

    closeCleanupModal();
    // Refresh user list
    await fetchAdminUsers();
    return true;
  } catch {
    cleanupError.value = 'Network error during test cleanup.';
    return false;
  } finally {
    isExecutingCleanup.value = false;
  }
}
