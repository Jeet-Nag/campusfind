import { signal } from '@preact/signals';
import { CampusItem, CampusClaim, CampusCategory, CampusItemType, CampusItemStatus, ApiResponse } from '@shared';
import { authToken, isAuthenticated } from './auth';

export type CampusView =
  | 'home'
  | 'browse'
  | 'report-lost'
  | 'report-found'
  | 'item-detail'
  | 'my-reports'
  | 'auth';

// Navigation State
export const currentView = signal<CampusView>('home');
export const selectedItemId = signal<string | null>(null);
export const editItemId = signal<string | null>(null);
export const globalNotification = signal<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

export function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success', durationMs = 4000) {
  globalNotification.value = { type, message };
  setTimeout(() => {
    if (globalNotification.value?.message === message) {
      globalNotification.value = null;
    }
  }, durationMs);
}

export function navigateTo(view: CampusView, itemId?: string | null) {
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
export const campusItems = signal<CampusItem[]>([]);
export const itemsLoading = signal<boolean>(false);
export const itemsError = signal<string | null>(null);

// Filters State
export const filterType = signal<string>('all'); // 'all' | 'lost' | 'found'
export const filterCategory = signal<string>('all');
export const filterLocation = signal<string>('all');
export const filterStatus = signal<string>('all');
export const searchQuery = signal<string>('');

export async function fetchCampusItems(): Promise<void> {
  itemsLoading.value = true;
  itemsError.value = null;

  try {
    const params = new URLSearchParams();
    if (filterType.value !== 'all') params.append('type', filterType.value);
    if (filterCategory.value !== 'all') params.append('category', filterCategory.value);
    if (filterLocation.value !== 'all') params.append('location', filterLocation.value);
    if (filterStatus.value !== 'all') params.append('status', filterStatus.value);
    if (searchQuery.value.trim().length > 0) params.append('search', searchQuery.value.trim());

    const res = await fetch(`/api/campus/items?${params.toString()}`);
    const data: ApiResponse<CampusItem[]> = await res.json();

    if (!res.ok || !data.success || !data.data) {
      itemsError.value = data.error?.messageEn || 'Failed to load campus items.';
      return;
    }

    campusItems.value = data.data;
  } catch (err: any) {
    itemsError.value = 'Network error while fetching items. Please check connection.';
  } finally {
    itemsLoading.value = false;
  }
}

// Item Detail State
export const activeItem = signal<CampusItem | null>(null);
export const activeItemClaims = signal<CampusClaim[]>([]);
export const itemDetailLoading = signal<boolean>(false);
export const itemDetailError = signal<string | null>(null);

export async function fetchItemDetail(id: string): Promise<void> {
  itemDetailLoading.value = true;
  itemDetailError.value = null;

  try {
    const headers: Record<string, string> = {};
    if (authToken.value) {
      headers['Authorization'] = `Bearer ${authToken.value}`;
    }

    const res = await fetch(`/api/campus/items/${id}`, { headers });
    const data: ApiResponse<{ item: CampusItem; claims?: CampusClaim[] }> = await res.json();

    if (!res.ok || !data.success || !data.data) {
      itemDetailError.value = data.error?.messageEn || 'Item not found.';
      activeItem.value = null;
      activeItemClaims.value = [];
      return;
    }

    activeItem.value = data.data.item;
    activeItemClaims.value = data.data.claims || [];
  } catch (err: any) {
    itemDetailError.value = 'Failed to load item details. Please check connection.';
  } finally {
    itemDetailLoading.value = false;
  }
}

// User Reports and Claims State
export const myReports = signal<CampusItem[]>([]);
export const myClaims = signal<CampusClaim[]>([]);
export const myReportsLoading = signal<boolean>(false);
export const myReportsError = signal<string | null>(null);

export async function fetchMyReports(): Promise<void> {
  if (!isAuthenticated.value || !authToken.value) return;

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

    const reportsData: ApiResponse<CampusItem[]> = await reportsRes.json();
    const claimsData: ApiResponse<CampusClaim[]> = await claimsRes.json();

    if (reportsData.success && reportsData.data) {
      myReports.value = reportsData.data;
    }
    if (claimsData.success && claimsData.data) {
      myClaims.value = claimsData.data;
    }
  } catch (err: any) {
    myReportsError.value = 'Failed to load your reports.';
  } finally {
    myReportsLoading.value = false;
  }
}

// Form Submissions
export async function submitItemReport(payload: {
  type: CampusItemType;
  title: string;
  category: CampusCategory;
  description: string;
  location: string;
  dateOccurred: string;
  contactMethod: string;
  imageUrl?: string | null;
  isSensitive?: boolean;
  sensitiveDetails?: string | null;
}): Promise<{ success: boolean; error?: string; item?: CampusItem }> {
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

    const data: ApiResponse<CampusItem> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      return { success: false, error: data.error?.messageEn || 'Failed to submit report.' };
    }

    // Refresh listing & my reports
    await fetchCampusItems();
    await fetchMyReports();
    return { success: true, item: data.data };
  } catch (err: any) {
    return { success: false, error: 'Network error submitting report. Please try again.' };
  }
}

export async function updateItemReport(
  id: string,
  updates: Partial<CampusItem>
): Promise<{ success: boolean; error?: string }> {
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

    const data: ApiResponse<CampusItem> = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error?.messageEn || 'Failed to update report.' };
    }

    await fetchCampusItems();
    await fetchMyReports();
    if (selectedItemId.value === id) {
      await fetchItemDetail(id);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Network error updating report.' };
  }
}

export async function deleteItemReport(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isAuthenticated.value || !authToken.value) {
    return { success: false, error: 'Authentication required.' };
  }

  try {
    const res = await fetch(`/api/campus/items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken.value}` },
    });

    const data: ApiResponse = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error?.messageEn || 'Failed to delete report.' };
    }

    await fetchCampusItems();
    await fetchMyReports();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Network error deleting report.' };
  }
}

export async function submitClaimRequest(
  itemId: string,
  payload: {
    claimantName: string;
    claimantContact: string;
    distinguishingFeature: string;
    message?: string;
  }
): Promise<{ success: boolean; error?: string }> {
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

    const data: ApiResponse<CampusClaim> = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error?.messageEn || 'Failed to submit claim.' };
    }

    // Refresh active item and claims list
    await fetchItemDetail(itemId);
    await fetchCampusItems();
    await fetchMyReports();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Network error submitting claim.' };
  }
}

export async function reviewClaimRequest(
  claimId: string,
  status: 'accepted' | 'rejected',
  ownerResponse?: string
): Promise<{ success: boolean; error?: string }> {
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

    const data: ApiResponse<CampusClaim> = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error?.messageEn || 'Failed to review claim.' };
    }

    if (selectedItemId.value) {
      await fetchItemDetail(selectedItemId.value);
    }
    await fetchCampusItems();
    await fetchMyReports();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Network error reviewing claim.' };
  }
}

export async function uploadItemPhoto(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
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

    const data: ApiResponse<{ url: string; filename: string }> = await res.json();
    if (!res.ok || !data.success || !data.data) {
      return { success: false, error: data.error?.messageEn || 'Failed to upload photo.' };
    }

    return { success: true, url: data.data.url };
  } catch (err: any) {
    return { success: false, error: 'Network error uploading photo.' };
  }
}
