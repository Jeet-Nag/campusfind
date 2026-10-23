import { signal } from '@preact/signals';
import { authToken, isAuthenticated } from './auth';
// Navigation State
export const currentView = signal('home');
export const selectedItemId = signal(null);
export const editItemId = signal(null);
export const globalNotification = signal(null);
export function showNotification(message, type = 'success', durationMs = 4000) {
    globalNotification.value = { type, message };
    setTimeout(() => {
        if (globalNotification.value?.message === message) {
            globalNotification.value = null;
        }
    }, durationMs);
}
export function navigateTo(view, itemId) {
    currentView.value = view;
    if (itemId !== undefined) {
        selectedItemId.value = itemId;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Update browser history for native navigation and refreshes
    const path = view === 'home'
        ? '/'
        : view === 'item-detail' && itemId
            ? `/item/${itemId}`
            : `/${view}`;
    if (window.location.pathname !== path) {
        window.history.pushState({ view, itemId }, '', path);
    }
}
// Items Browsing State
export const campusItems = signal([]);
export const itemsLoading = signal(false);
export const itemsError = signal(null);
// Filters State
export const filterType = signal('all'); // 'all' | 'lost' | 'found'
export const filterCategory = signal('all');
export const filterLocation = signal('all');
export const filterStatus = signal('all');
export const searchQuery = signal('');
export async function fetchCampusItems() {
    itemsLoading.value = true;
    itemsError.value = null;
    try {
        const params = new URLSearchParams();
        if (filterType.value !== 'all')
            params.append('type', filterType.value);
        if (filterCategory.value !== 'all')
            params.append('category', filterCategory.value);
        if (filterLocation.value !== 'all')
            params.append('location', filterLocation.value);
        if (filterStatus.value !== 'all')
            params.append('status', filterStatus.value);
        if (searchQuery.value.trim().length > 0)
            params.append('search', searchQuery.value.trim());
        const res = await fetch(`/api/campus/items?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.success || !data.data) {
            itemsError.value = data.error?.messageEn || 'Failed to load campus items.';
            return;
        }
        campusItems.value = data.data;
    }
    catch (err) {
        itemsError.value = 'Network error while fetching items. Please check connection.';
    }
    finally {
        itemsLoading.value = false;
    }
}
// Item Detail State
export const activeItem = signal(null);
export const activeItemClaims = signal([]);
export const itemDetailLoading = signal(false);
export const itemDetailError = signal(null);
export async function fetchItemDetail(id) {
    itemDetailLoading.value = true;
    itemDetailError.value = null;
    try {
        const headers = {};
        if (authToken.value) {
            headers['Authorization'] = `Bearer ${authToken.value}`;
        }
        const res = await fetch(`/api/campus/items/${id}`, { headers });
        const data = await res.json();
        if (!res.ok || !data.success || !data.data) {
            itemDetailError.value = data.error?.messageEn || 'Item not found.';
            activeItem.value = null;
            activeItemClaims.value = [];
            return;
        }
        activeItem.value = data.data.item;
        activeItemClaims.value = data.data.claims || [];
    }
    catch (err) {
        itemDetailError.value = 'Failed to load item details. Please check connection.';
    }
    finally {
        itemDetailLoading.value = false;
    }
}
// User Reports and Claims State
export const myReports = signal([]);
export const myClaims = signal([]);
export const myReportsLoading = signal(false);
export const myReportsError = signal(null);
export async function fetchMyReports() {
    if (!isAuthenticated.value || !authToken.value)
        return;
    myReportsLoading.value = true;
    myReportsError.value = null;
    try {
        const [reportsRes, claimsRes] = await Promise.all([
            fetch('/api/campus/items/my-reports', {
                headers: { Authorization: `Bearer ${authToken.value}` },
            }),
            fetch('/api/campus/claims/my-claims', {
                headers: { Authorization: `Bearer ${authToken.value}` },
            }),
        ]);
        const reportsData = await reportsRes.json();
        const claimsData = await claimsRes.json();
        if (reportsData.success && reportsData.data) {
            myReports.value = reportsData.data;
        }
        if (claimsData.success && claimsData.data) {
            myClaims.value = claimsData.data;
        }
    }
    catch (err) {
        myReportsError.value = 'Failed to load your reports.';
    }
    finally {
        myReportsLoading.value = false;
    }
}
// Form Submissions
export async function submitItemReport(payload) {
    if (!isAuthenticated.value || !authToken.value) {
        return { success: false, error: 'Please sign in to submit a report.' };
    }
    try {
        const res = await fetch('/api/campus/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken.value}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.data) {
            return { success: false, error: data.error?.messageEn || 'Failed to submit report.' };
        }
        // Refresh listing & my reports
        await fetchCampusItems();
        await fetchMyReports();
        return { success: true, item: data.data };
    }
    catch (err) {
        return { success: false, error: 'Network error submitting report. Please try again.' };
    }
}
export async function updateItemReport(id, updates) {
    if (!isAuthenticated.value || !authToken.value) {
        return { success: false, error: 'Authentication required.' };
    }
    try {
        const res = await fetch(`/api/campus/items/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken.value}`,
            },
            body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, error: data.error?.messageEn || 'Failed to update report.' };
        }
        await fetchCampusItems();
        await fetchMyReports();
        if (selectedItemId.value === id) {
            await fetchItemDetail(id);
        }
        return { success: true };
    }
    catch (err) {
        return { success: false, error: 'Network error updating report.' };
    }
}
export async function deleteItemReport(id) {
    if (!isAuthenticated.value || !authToken.value) {
        return { success: false, error: 'Authentication required.' };
    }
    try {
        const res = await fetch(`/api/campus/items/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken.value}` },
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, error: data.error?.messageEn || 'Failed to delete report.' };
        }
        await fetchCampusItems();
        await fetchMyReports();
        return { success: true };
    }
    catch (err) {
        return { success: false, error: 'Network error deleting report.' };
    }
}
export async function submitClaimRequest(itemId, payload) {
    if (!isAuthenticated.value || !authToken.value) {
        return { success: false, error: 'Please sign in to submit a claim.' };
    }
    try {
        const res = await fetch(`/api/campus/items/${itemId}/claim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken.value}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, error: data.error?.messageEn || 'Failed to submit claim.' };
        }
        // Refresh active item and claims list
        await fetchItemDetail(itemId);
        await fetchCampusItems();
        await fetchMyReports();
        return { success: true };
    }
    catch (err) {
        return { success: false, error: 'Network error submitting claim.' };
    }
}
export async function reviewClaimRequest(claimId, status, ownerResponse) {
    if (!isAuthenticated.value || !authToken.value) {
        return { success: false, error: 'Authentication required.' };
    }
    try {
        const res = await fetch(`/api/campus/claims/${claimId}/review`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken.value}`,
            },
            body: JSON.stringify({ status, ownerResponse }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, error: data.error?.messageEn || 'Failed to review claim.' };
        }
        if (selectedItemId.value) {
            await fetchItemDetail(selectedItemId.value);
        }
        await fetchCampusItems();
        await fetchMyReports();
        return { success: true };
    }
    catch (err) {
        return { success: false, error: 'Network error reviewing claim.' };
    }
}
export async function uploadItemPhoto(file) {
    if (!isAuthenticated.value || !authToken.value) {
        return { success: false, error: 'Please sign in to upload photos.' };
    }
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/campus/upload', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken.value}`,
            },
            body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.data) {
            return { success: false, error: data.error?.messageEn || 'Failed to upload photo.' };
        }
        return { success: true, url: data.data.url };
    }
    catch (err) {
        return { success: false, error: 'Network error uploading photo.' };
    }
}
