import { signal, computed } from '@preact/signals';
import { authToken, handleSessionExpired } from './auth';
// User list & loading state
export const usersList = signal([]);
export const isUsersLoading = signal(false);
export const usersError = signal(null);
export const usersSuccessMessage = signal(null);
// Search & Filter state
export const userSearchQuery = signal('');
export const userRoleFilter = signal('all');
export const userStatusFilter = signal('all');
export const userTestFilter = signal('all');
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
export const deactivatingUser = signal(null);
export const isDeactivatingUser = signal(false);
export const deactivateUserError = signal(null);
// Permanent Deletion Modal state
export const deletingUser = signal(null);
export const deletePhoneInput = signal('');
export const isDeletingUser = signal(false);
export const deleteUserError = signal(null);
// Test Marking state
export const markingUserId = signal(null);
export const markingTestUser = signal(null);
export const markTestError = signal(null);
// Test Data Cleanup state
export const isCleanupModalOpen = signal(false);
export const cleanupPreview = signal(null);
export const isLoadingCleanupPreview = signal(false);
export const cleanupConfirmInput = signal('');
export const isExecutingCleanup = signal(false);
export const cleanupError = signal(null);
export function clearUserSuccessMessage() {
    usersSuccessMessage.value = null;
}
/**
 * Fetches all registered users from the administrative API.
 */
export async function fetchAdminUsers() {
    const token = authToken.value;
    if (!token)
        return;
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
        const body = await res.json();
        if (!body.success || !body.data) {
            usersError.value = 'LOAD_ERROR';
            return;
        }
        usersList.value = body.data.users;
    }
    catch {
        usersError.value = 'NETWORK_ERROR';
    }
    finally {
        isUsersLoading.value = false;
    }
}
/**
 * Toggles a user's active/inactive status.
 */
export async function toggleUserStatus(user, isActive) {
    const token = authToken.value;
    if (!token)
        return false;
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
        const body = await res.json();
        if (!body.success || !body.data) {
            return false;
        }
        // Update in-memory list
        usersList.value = usersList.value.map((u) => (u.id === user.id ? body.data.user : u));
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Toggles whether a user is flagged as test data.
 */
export async function toggleUserTestMark(user) {
    const token = authToken.value;
    if (!token)
        return false;
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
        const body = await res.json();
        if (!body.success || !body.data) {
            return false;
        }
        usersList.value = usersList.value.map((u) => (u.id === user.id ? body.data.user : u));
        return true;
    }
    catch {
        return false;
    }
    finally {
        markingUserId.value = null;
    }
}
// Modal controls for Test Data Status
export function openMarkTestModal(user) {
    markingTestUser.value = user;
    markTestError.value = null;
}
export function closeMarkTestModal() {
    markingTestUser.value = null;
    markTestError.value = null;
}
export async function confirmToggleUserTestMark() {
    const user = markingTestUser.value;
    if (!user)
        return;
    markTestError.value = null;
    const success = await toggleUserTestMark(user);
    if (success) {
        closeMarkTestModal();
    }
    else {
        markTestError.value = 'Failed to update test data status.';
    }
}
// Modal controls for Deactivation
export function openDeactivateModal(user) {
    deactivatingUser.value = user;
    deactivateUserError.value = null;
}
export function closeDeactivateModal() {
    deactivatingUser.value = null;
    deactivateUserError.value = null;
    isDeactivatingUser.value = false;
}
export async function confirmDeactivateUser() {
    const user = deactivatingUser.value;
    if (!user)
        return;
    isDeactivatingUser.value = true;
    deactivateUserError.value = null;
    const success = await toggleUserStatus(user, false);
    isDeactivatingUser.value = false;
    if (success) {
        closeDeactivateModal();
    }
    else {
        deactivateUserError.value = 'Failed to deactivate user.';
    }
}
// Modal controls for Permanent Deletion
export function openDeleteModal(user) {
    deletingUser.value = user;
    deletePhoneInput.value = '';
    deleteUserError.value = null;
}
export function closeDeleteModal() {
    deletingUser.value = null;
    deletePhoneInput.value = '';
    deleteUserError.value = null;
    isDeletingUser.value = false;
}
export async function confirmDeleteUser() {
    const user = deletingUser.value;
    const token = authToken.value;
    if (!user || !token)
        return false;
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
        const body = await res.json();
        if (!body.success) {
            deleteUserError.value = body.error?.messageEn || 'Deletion failed.';
            return false;
        }
        // Remove user or refresh list
        usersList.value = usersList.value.filter((u) => u.id !== user.id);
        closeDeleteModal();
        return true;
    }
    catch {
        deleteUserError.value = 'Network error occurred during deletion.';
        return false;
    }
    finally {
        isDeletingUser.value = false;
    }
}
// Modal controls for Safe Test Cleanup
export async function openCleanupModal() {
    isCleanupModalOpen.value = true;
    cleanupConfirmInput.value = '';
    cleanupError.value = null;
    cleanupPreview.value = null;
    await fetchCleanupPreview();
}
export function closeCleanupModal() {
    isCleanupModalOpen.value = false;
    cleanupConfirmInput.value = '';
    cleanupError.value = null;
    cleanupPreview.value = null;
}
export async function fetchCleanupPreview() {
    const token = authToken.value;
    if (!token)
        return;
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
        const body = await res.json();
        if (body.success && body.data) {
            cleanupPreview.value = body.data;
        }
        else {
            cleanupError.value = body.error?.messageEn || 'Failed to fetch preview.';
        }
    }
    catch {
        cleanupError.value = 'Network error fetching preview.';
    }
    finally {
        isLoadingCleanupPreview.value = false;
    }
}
export async function executeCleanup() {
    const token = authToken.value;
    if (!token)
        return false;
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
        const body = await res.json();
        if (!body.success) {
            cleanupError.value = body.error?.messageEn || 'Cleanup failed.';
            return false;
        }
        closeCleanupModal();
        // Refresh user list
        await fetchAdminUsers();
        return true;
    }
    catch {
        cleanupError.value = 'Network error during test cleanup.';
        return false;
    }
    finally {
        isExecutingCleanup.value = false;
    }
}
