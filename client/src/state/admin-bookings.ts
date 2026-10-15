import { signal, computed } from '@preact/signals';
import {
  ApiResponse,
  AdminBookingListItem,
  AdminBookingDetail,
  AdminProviderView,
  BookingStatus,
  canTransition,
} from '@shared';
import { authToken, handleSessionExpired } from './auth';
import { currentLanguage, t } from './language';

// Main booking list state
export const bookingsList = signal<AdminBookingListItem[]>([]);
export const bookingsTotal = signal<number>(0);
export const bookingsLimit = signal<number>(25);
export const bookingsOffset = signal<number>(0);
export const isBookingsLoading = signal<boolean>(false);
export const bookingsError = signal<string | null>(null);

// Clamps limit between 1 and 100 (default: 25)
export function getEffectiveLimit(): number {
  const lim = bookingsLimit.value;
  if (!lim || isNaN(lim)) return 25;
  return Math.min(Math.max(1, lim), 100);
}

// Search and filters
export const bookingSearchQuery = signal<string>('');
export const bookingStatusFilter = signal<string>('all');
export const bookingCategoryFilter = signal<string>('all');
export const bookingLocalityFilter = signal<string>('all');
export const bookingProviderFilter = signal<string>('all');

// Pagination computed properties
export const currentPage = computed(() => {
  const limit = getEffectiveLimit();
  return Math.floor(bookingsOffset.value / limit) + 1;
});

export const totalPages = computed(() => {
  const limit = getEffectiveLimit();
  return Math.max(1, Math.ceil(bookingsTotal.value / limit));
});

export const hasPrevPage = computed(() => bookingsOffset.value > 0);

export const hasNextPage = computed(() => {
  const limit = getEffectiveLimit();
  return bookingsOffset.value + limit < bookingsTotal.value;
});

export const showingRange = computed(() => {
  const total = bookingsTotal.value;
  if (total === 0) return { from: 0, to: 0, total: 0 };
  const limit = getEffectiveLimit();
  const from = bookingsOffset.value + 1;
  const to = Math.min(bookingsOffset.value + limit, total);
  return { from, to, total };
});

// Booking detail state
export const selectedBookingDetail = signal<AdminBookingDetail | null>(null);
export const isDetailLoading = signal<boolean>(false);
export const detailError = signal<string | null>(null);
export const isDetailModalOpen = signal<boolean>(false);

// Detail Audio playback
export const isPlayingDetailAudio = signal<boolean>(false);
export const detailAudioError = signal<string | null>(null);
let detailAudioElement: HTMLAudioElement | null = null;

// Cancellation modal state
export const isCancelModalOpen = signal<boolean>(false);
export const cancelReason = signal<string>('');
export const cancelReasonError = signal<string | null>(null);
export const isCancelling = signal<boolean>(false);
export const cancelError = signal<string | null>(null);
export const cancelSuccessMessage = signal<string | null>(null);

// Module 12D: Provider Assignment Modal State
export const isAssignModalOpen = signal<boolean>(false);
export const assignSelectedProviderId = signal<string | null>(null);
export const assignSearchQuery = signal<string>('');
export const isAssigning = signal<boolean>(false);
export const assignError = signal<string | null>(null);
export const assignSuccessMessage = signal<string | null>(null);
export const assignableProviders = signal<AdminProviderView[]>([]);
export const isAssignProvidersLoading = signal<boolean>(false);
export const assignProvidersError = signal<string | null>(null);

/**
 * Filtered and sorted providers for assignment:
 * - Search by name or phone
 * - Category matching prioritized first
 * - Available prioritized over unavailable
 */
export const filteredAssignableProviders = computed(() => {
  const query = assignSearchQuery.value.trim().toLowerCase();
  const detail = selectedBookingDetail.value;
  const bookingCategoryId = detail?.category?.id || '';

  let list = assignableProviders.value;

  if (query) {
    list = list.filter((p) => {
      const nameMatch = p.fullName ? p.fullName.toLowerCase().includes(query) : false;
      const phoneMatch = p.phone.toLowerCase().includes(query);
      return nameMatch || phoneMatch;
    });
  }

  return [...list].sort((a, b) => {
    const aMatch = bookingCategoryId ? a.categoryId === bookingCategoryId : false;
    const bMatch = bookingCategoryId ? b.categoryId === bookingCategoryId : false;

    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;

    if (a.isAvailable && !b.isAvailable) return -1;
    if (!a.isAvailable && b.isAvailable) return 1;

    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;

    const nameA = a.fullName || '';
    const nameB = b.fullName || '';
    return nameA.localeCompare(nameB);
  });
});

/**
 * Validates cancellation reason text (3–255 characters).
 */
export function validateCancelReason(reasonText: string): string | null {
  const trimmed = reasonText.trim();
  if (trimmed.length < 3) {
    return t('admin.cancel_reason_required');
  }
  if (trimmed.length > 255) {
    return t('admin.cancel_reason_max');
  }
  return null;
}

let currentAdminAudioObjectUrl: string | null = null;

/**
 * Stop any currently playing audio in booking detail.
 */
export function stopDetailAudio(): void {
  if (detailAudioElement) {
    try {
      detailAudioElement.pause();
      detailAudioElement.currentTime = 0;
    } catch {
      // Ignore
    }
    detailAudioElement = null;
  }
  if (currentAdminAudioObjectUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    try {
      URL.revokeObjectURL(currentAdminAudioObjectUrl);
    } catch {
      // Ignore
    }
    currentAdminAudioObjectUrl = null;
  }
  isPlayingDetailAudio.value = false;
  detailAudioError.value = null;
}

/**
 * Toggle audio playback for active booking detail.
 */
export async function toggleDetailAudio(audioUrl?: string | null): Promise<void> {
  const url = audioUrl || selectedBookingDetail.value?.booking.audioUrl;
  if (!url) return;

  if (isPlayingDetailAudio.value && detailAudioElement) {
    stopDetailAudio();
    return;
  }

  stopDetailAudio();

  try {
    const token = authToken.value;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      detailAudioError.value = t('admin.audio_playback_error');
      return;
    }

    const blob = await res.blob();
    const objectUrl = (typeof URL !== 'undefined' && URL.createObjectURL)
      ? URL.createObjectURL(blob)
      : url;
    currentAdminAudioObjectUrl = objectUrl;

    const audio = new Audio(objectUrl);
    detailAudioElement = audio;

    audio.onended = () => {
      stopDetailAudio();
    };
    audio.onerror = () => {
      stopDetailAudio();
      detailAudioError.value = t('admin.audio_playback_error');
    };

    await audio.play();
    isPlayingDetailAudio.value = true;
    detailAudioError.value = null;
  } catch {
    stopDetailAudio();
    detailAudioError.value = t('admin.audio_playback_error');
  }
}

/**
 * Fetches admin bookings with pagination and filters.
 */
export async function fetchAdminBookings(pageOffset?: number): Promise<void> {
  const token = authToken.value;
  if (!token) return;

  isBookingsLoading.value = true;
  bookingsError.value = null;

  const targetOffset = pageOffset !== undefined ? pageOffset : bookingsOffset.value;

  try {
    const params = new URLSearchParams();
    if (bookingStatusFilter.value && bookingStatusFilter.value !== 'all') {
      params.append('status', bookingStatusFilter.value);
    }
    if (bookingCategoryFilter.value && bookingCategoryFilter.value !== 'all') {
      params.append('category_id', bookingCategoryFilter.value);
    }
    if (bookingLocalityFilter.value && bookingLocalityFilter.value !== 'all') {
      params.append('area_locality', bookingLocalityFilter.value);
    }
    if (bookingProviderFilter.value && bookingProviderFilter.value !== 'all') {
      params.append('provider_id', bookingProviderFilter.value);
    }
    if (bookingSearchQuery.value.trim().length > 0) {
      params.append('search', bookingSearchQuery.value.trim());
    }

    const effectiveLimit = getEffectiveLimit();
    params.append('limit', String(effectiveLimit));
    params.append('offset', String(targetOffset));

    const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    if (!res.ok) {
      bookingsError.value = t('admin.load_bookings_error');
      return;
    }

    const body: ApiResponse<{
      bookings: AdminBookingListItem[];
      total: number;
      limit: number;
      offset: number;
    }> = await res.json();

    if (body.success && body.data) {
      bookingsList.value = body.data.bookings;
      bookingsTotal.value = body.data.total;
      bookingsLimit.value = body.data.limit;
      bookingsOffset.value = body.data.offset;
    } else {
      bookingsError.value = body.error?.messageEn || t('admin.load_bookings_error');
    }
  } catch {
    bookingsError.value = t('admin.load_bookings_error');
  } finally {
    isBookingsLoading.value = false;
  }
}

/**
 * Sets current pagination page.
 */
export function setBookingPage(page: number): void {
  const total = totalPages.value;
  const safePage = Math.max(1, Math.min(page, total));
  const offset = (safePage - 1) * getEffectiveLimit();
  fetchAdminBookings(offset);
}

export function nextBookingPage(): void {
  if (hasNextPage.value) {
    setBookingPage(currentPage.value + 1);
  }
}

export function prevBookingPage(): void {
  if (hasPrevPage.value) {
    setBookingPage(currentPage.value - 1);
  }
}

/**
 * Resets all search and filter fields and fetches page 1.
 */
export function clearBookingFilters(): void {
  bookingSearchQuery.value = '';
  bookingStatusFilter.value = 'all';
  bookingCategoryFilter.value = 'all';
  bookingLocalityFilter.value = 'all';
  bookingProviderFilter.value = 'all';
  fetchAdminBookings(0);
}

/**
 * Opens detailed modal for a specific booking.
 */
export async function openBookingDetail(bookingId: string): Promise<void> {
  const token = authToken.value;
  if (!token) return;

  stopDetailAudio();
  isDetailModalOpen.value = true;
  selectedBookingDetail.value = null;
  detailError.value = null;
  isDetailLoading.value = true;

  try {
    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    if (!res.ok) {
      detailError.value = t('admin.load_detail_error');
      return;
    }

    const body: ApiResponse<AdminBookingDetail> = await res.json();
    if (body.success && body.data) {
      selectedBookingDetail.value = body.data;
    } else {
      detailError.value = body.error?.messageEn || t('admin.load_detail_error');
    }
  } catch {
    detailError.value = t('admin.load_detail_error');
  } finally {
    isDetailLoading.value = false;
  }
}

/**
 * Closes detailed modal.
 */
export function closeBookingDetail(): void {
  stopDetailAudio();
  isDetailModalOpen.value = false;
  selectedBookingDetail.value = null;
  detailError.value = null;
}

/**
 * Refreshes current booking detail silently without closing modal.
 */
export async function refreshSelectedBookingDetail(): Promise<void> {
  const detail = selectedBookingDetail.value;
  if (!detail) return;
  const token = authToken.value;
  if (!token) return;

  try {
    const res = await fetch(`/api/admin/bookings/${detail.booking.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const body: ApiResponse<AdminBookingDetail> = await res.json();
      if (body.success && body.data) {
        selectedBookingDetail.value = body.data;
      }
    }
  } catch {
    // Non-blocking background refresh
  }
}

/**
 * Opens cancellation modal for currently viewed booking.
 */
export function openCancelModal(): void {
  cancelReason.value = '';
  cancelReasonError.value = null;
  cancelError.value = null;
  isCancelModalOpen.value = true;
}

/**
 * Closes cancellation modal.
 */
export function closeCancelModal(): void {
  isCancelModalOpen.value = false;
  cancelReason.value = '';
  cancelReasonError.value = null;
  cancelError.value = null;
}

/**
 * Submits administrative booking cancellation.
 */
export async function submitCancelBooking(): Promise<boolean> {
  const detail = selectedBookingDetail.value;
  if (!detail) return false;

  const validation = validateCancelReason(cancelReason.value);
  if (validation) {
    cancelReasonError.value = validation;
    return false;
  }

  const token = authToken.value;
  if (!token) {
    handleSessionExpired();
    return false;
  }

  isCancelling.value = true;
  cancelError.value = null;
  cancelReasonError.value = null;

  try {
    const res = await fetch(`/api/admin/bookings/${detail.booking.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reason: cancelReason.value.trim(),
      }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{ booking: AdminBookingDetail['booking'] }> = await res.json();

    if (!res.ok || !body.success) {
      if (res.status === 409) {
        cancelError.value = currentLanguage.value === 'hi'
          ? (body.error?.messageHi || t('admin.cancel_conflict_error'))
          : (body.error?.messageEn || t('admin.cancel_conflict_error'));
      } else {
        cancelError.value = currentLanguage.value === 'hi'
          ? (body.error?.messageHi || t('admin.cancel_conflict_error'))
          : (body.error?.messageEn || t('admin.cancel_conflict_error'));
      }
      return false;
    }

    // Success: update active booking detail status and refresh timeline
    if (selectedBookingDetail.value) {
      selectedBookingDetail.value = {
        ...selectedBookingDetail.value,
        booking: {
          ...selectedBookingDetail.value.booking,
          status: 'CANCELLED_BY_ADMIN',
        },
      };
    }

    const shortId = detail.booking.id.slice(0, 8);
    cancelSuccessMessage.value = t('admin.cancel_success', { id: `#${shortId}` });

    closeCancelModal();
    // Refresh detail and list
    await refreshSelectedBookingDetail();
    await fetchAdminBookings();

    return true;
  } catch {
    cancelError.value = t('admin.cancel_conflict_error');
    return false;
  } finally {
    isCancelling.value = false;
  }
}

export function clearCancelSuccessMessage(): void {
  cancelSuccessMessage.value = null;
}

/**
 * Opens provider assignment modal and fetches available providers.
 */
export async function openAssignModal(): Promise<void> {
  assignSelectedProviderId.value = null;
  assignSearchQuery.value = '';
  assignError.value = null;
  isAssignModalOpen.value = true;
  await loadAssignableProviders();
}

/**
 * Closes provider assignment modal.
 */
export function closeAssignModal(): void {
  isAssignModalOpen.value = false;
  assignSelectedProviderId.value = null;
  assignSearchQuery.value = '';
  assignError.value = null;
}

/**
 * Fetches all registered providers for the assignment selector.
 */
export async function loadAssignableProviders(): Promise<void> {
  const token = authToken.value;
  if (!token) return;

  isAssignProvidersLoading.value = true;
  assignProvidersError.value = null;

  try {
    const res = await fetch('/api/admin/providers', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return;
    }

    if (!res.ok) {
      assignProvidersError.value = t('admin.assign_load_providers_error');
      return;
    }

    const body: ApiResponse<{ providers: AdminProviderView[] }> = await res.json();
    if (body.success && body.data) {
      assignableProviders.value = body.data.providers || [];
    } else {
      assignProvidersError.value = t('admin.assign_load_providers_error');
    }
  } catch {
    assignProvidersError.value = t('admin.assign_load_providers_error');
  } finally {
    isAssignProvidersLoading.value = false;
  }
}

/**
 * Selects a target provider for assignment.
 */
export function setAssignSelectedProvider(providerId: string): void {
  const p = assignableProviders.value.find((prov) => prov.id === providerId);
  const detail = selectedBookingDetail.value;
  const isMatchingCategory = detail ? p?.categoryId === detail.category.id : true;
  const isVerified = p?.verificationStatus === 'VERIFIED';
  const isBusy = (p?.activeBookingsCount ?? 0) > 0;

  if (p && (!p.isActive || !p.isAvailable || !isMatchingCategory || !isVerified || isBusy)) {
    return;
  }
  assignSelectedProviderId.value = providerId;
  assignError.value = null;
}

/**
 * Submits administrative provider assignment.
 * Transitions strictly SERVICE_REQUESTED -> PROVIDER_ASSIGNED.
 */
export async function submitAssignProvider(): Promise<boolean> {
  const detail = selectedBookingDetail.value;
  if (!detail) return false;

  if (!assignSelectedProviderId.value) {
    assignError.value = t('admin.assign_select_prompt');
    return false;
  }

  if (isAssigning.value) return false;

  const token = authToken.value;
  if (!token) {
    handleSessionExpired();
    return false;
  }

  isAssigning.value = true;
  assignError.value = null;

  try {
    const res = await fetch(`/api/admin/bookings/${detail.booking.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        providerId: assignSelectedProviderId.value,
      }),
    });

    if (res.status === 401) {
      handleSessionExpired();
      return false;
    }

    const body: ApiResponse<{
      booking: AdminBookingDetail['booking'];
      provider: AdminBookingDetail['provider'];
    }> = await res.json();

    if (!res.ok || !body.success) {
      const errCode = body.error?.code;

      if (errCode === 'BOOKING_ALREADY_ASSIGNED' || errCode === 'INVALID_STATUS_TRANSITION') {
        assignError.value = t('admin.assign_conflict_error');
      } else if (errCode === 'ACTIVE_BOOKING_EXISTS') {
        assignError.value = t('admin.assign_active_booking_exists');
      } else if (errCode === 'PROVIDER_INACTIVE') {
        assignError.value = t('admin.assign_provider_inactive');
      } else if (errCode === 'PROVIDER_UNAVAILABLE') {
        assignError.value = t('admin.assign_provider_unavailable');
      } else if (errCode === 'CATEGORY_MISMATCH') {
        assignError.value = t('admin.assign_category_mismatch');
      } else if (errCode === 'INVALID_PROVIDER_ROLE') {
        assignError.value = t('admin.assign_invalid_provider_role');
      } else if (errCode === 'PROVIDER_PROFILE_MISSING') {
        assignError.value = t('admin.assign_provider_profile_missing');
      } else if (errCode === 'PROVIDER_NOT_FOUND') {
        assignError.value = t('admin.assign_provider_not_found');
      } else if (errCode === 'PROVIDER_NOT_VERIFIED') {
        assignError.value = t('admin.assign_provider_not_verified');
      } else {
        assignError.value = currentLanguage.value === 'hi'
          ? (body.error?.messageHi || t('admin.assign_generic_error'))
          : (body.error?.messageEn || t('admin.assign_generic_error'));
      }

      if (res.status === 409 || errCode === 'BOOKING_ALREADY_ASSIGNED' || errCode === 'INVALID_STATUS_TRANSITION') {
        await refreshSelectedBookingDetail();
        await fetchAdminBookings();
      }

      return false;
    }

    // Success: update active booking detail status and provider
    const assignedProvider = body.data?.provider || assignableProviders.value.find((p) => p.id === assignSelectedProviderId.value);
    const providerName = assignedProvider?.fullName || 'Technician';

    if (selectedBookingDetail.value) {
      selectedBookingDetail.value = {
        ...selectedBookingDetail.value,
        booking: {
          ...selectedBookingDetail.value.booking,
          status: 'PROVIDER_ASSIGNED',
          timestamps: {
            ...selectedBookingDetail.value.booking.timestamps,
            ...(body.data?.booking?.timestamps || {}),
          },
        },
        provider: assignedProvider
          ? {
              id: assignedProvider.id,
              fullName: assignedProvider.fullName,
              phone: assignedProvider.phone,
              serviceArea: assignedProvider.serviceArea,
              rating: assignedProvider.rating,
            }
          : selectedBookingDetail.value.provider,
      };
    }

    assignSuccessMessage.value = t('admin.assign_success', { name: providerName });

    closeAssignModal();
    // Refresh detail and list from authoritative server
    await refreshSelectedBookingDetail();
    await fetchAdminBookings();

    return true;
  } catch {
    assignError.value = t('admin.assign_generic_error');
    return false;
  } finally {
    isAssigning.value = false;
  }
}

export function clearAssignSuccessMessage(): void {
  assignSuccessMessage.value = null;
}
