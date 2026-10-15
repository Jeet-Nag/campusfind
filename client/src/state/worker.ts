import { signal } from '@preact/signals';
import { ApiResponse, VerifiedWorkerSummary, WorkerVerificationStatus } from '@shared';
import { authToken, refreshSession, handleSessionExpired, currentUser, selectedOnboardingRole } from './auth';
import { currentLanguage } from './language';

export interface DocumentImageState {
  base64: string;
  mime: string;
  dataUrl: string;
}

export const workerStatus = signal<WorkerVerificationStatus | 'IDLE'>('IDLE');
export const workerStatusLoading = signal<boolean>(false);
export const workerStatusError = signal<string | null>(null);

export const workerFullName = signal<string>('');
export const workerCategoryId = signal<string>('');
export const aadhaarFront = signal<DocumentImageState | null>(null);
export const aadhaarBack = signal<DocumentImageState | null>(null);
export const workerPhoto = signal<DocumentImageState | null>(null);

export const rejectionReason = signal<string | null>(null);
export const rejectedAt = signal<string | null>(null);
export const existingHasFront = signal<boolean>(false);
export const existingHasBack = signal<boolean>(false);
export const existingHasPhoto = signal<boolean>(false);

export const isSubmittingWorker = signal<boolean>(false);
export const workerSubmitError = signal<string | null>(null);
export const workerSubmitSuccess = signal<boolean>(false);

export const verifiedWorkers = signal<VerifiedWorkerSummary[]>([]);
export const verifiedWorkersLoading = signal<boolean>(false);
export const verifiedWorkersError = signal<string | null>(null);

/**
 * Fetches the current user's worker onboarding / verification status from the backend.
 * If backend reports VERIFIED, authoritatively refreshes session from /api/auth/me
 * and validates that the user role is 'provider' before transitioning local worker status.
 */
export async function fetchWorkerStatus(): Promise<WorkerVerificationStatus | null> {
  const token = authToken.value;
  if (!token) {
    workerStatus.value = 'IDLE';
    return null;
  }

  workerStatusLoading.value = true;
  workerStatusError.value = null;

  try {
    const res = await fetch('/api/worker/status', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      handleSessionExpired();
      return null;
    }

    const data: ApiResponse<{
      status: WorkerVerificationStatus;
      hasSubmitted: boolean;
      fullName?: string | null;
      categoryId?: string | null;
      categoryTitleEn?: string | null;
      categoryTitleHi?: string | null;
      submittedAt?: string | null;
      verifiedAt?: string | null;
      rejectionReason?: string | null;
      rejectedAt?: string | null;
      hasAadhaarFront: boolean;
      hasAadhaarBack: boolean;
      hasPhoto: boolean;
    }> = await res.json();

    if (res.ok && data.success && data.data) {
      const status = data.data.status;
      rejectionReason.value = data.data.rejectionReason || null;
      rejectedAt.value = data.data.rejectedAt || null;
      existingHasFront.value = !!data.data.hasAadhaarFront;
      existingHasBack.value = !!data.data.hasAadhaarBack;
      existingHasPhoto.value = !!data.data.hasPhoto;
      if (data.data.categoryId) {
        workerCategoryId.value = data.data.categoryId;
      }
      if (data.data.fullName) {
        workerFullName.value = data.data.fullName;
      } else if (!workerFullName.value && currentUser.value?.fullName) {
        workerFullName.value = currentUser.value.fullName;
      }

      if (status === 'VERIFIED') {
        const refreshed = await refreshSession();
        if (refreshed && currentUser.value?.role === 'provider') {
          selectedOnboardingRole.value = null;
          workerStatus.value = 'VERIFIED';
          workerStatusError.value = null;
          return 'VERIFIED';
        } else {
          workerStatusError.value = currentLanguage.value === 'hi'
            ? 'सर्वर से प्रोफ़ाइल रीफ़्रेश करने में विफल। कृपया पुनः प्रयास करें।'
            : 'Failed to refresh verified user profile. Please try again.';
          return 'PENDING_VERIFICATION';
        }
      } else {
        workerStatus.value = status;
        workerStatusError.value = null;
        return status;
      }
    } else {
      workerStatusError.value = data.error?.messageEn || 'Failed to fetch status';
      return null;
    }
  } catch (err: any) {
    workerStatusError.value = err?.message || 'Network error';
    return null;
  } finally {
    workerStatusLoading.value = false;
  }
}

/**
 * Submits the worker onboarding profile with required documents.
 */
export async function submitWorkerOnboarding(): Promise<boolean> {
  const token = authToken.value;
  if (!token) {
    workerSubmitError.value = currentLanguage.value === 'hi'
      ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
      : 'Session expired. Please log in again.';
    return false;
  }

  const name = workerFullName.value.trim();
  const categoryId = workerCategoryId.value.trim();
  const front = aadhaarFront.value;
  const back = aadhaarBack.value;
  const photo = workerPhoto.value;

  // Frontend validation
  if (!name || name.length > 100) {
    workerSubmitError.value = currentLanguage.value === 'hi'
      ? 'कृपया अपना पूरा नाम दर्ज करें।'
      : 'Please enter your full name.';
    return false;
  }

  if (!categoryId) {
    workerSubmitError.value = currentLanguage.value === 'hi'
      ? 'कृपया अपना काम / श्रेणी चुनें।'
      : 'Please select your work / category.';
    return false;
  }

  const hasFront = !!front || existingHasFront.value;
  const hasBack = !!back || existingHasBack.value;
  const hasPhoto = !!photo || existingHasPhoto.value;

  if (!hasFront || !hasBack) {
    workerSubmitError.value = currentLanguage.value === 'hi'
      ? 'कृपया आधार कार्ड के दोनों तरफ (सामने और पीछे) का फोटो दें।'
      : 'Please provide both Aadhaar Front and Aadhaar Back photos.';
    return false;
  }

  if (!hasPhoto) {
    workerSubmitError.value = currentLanguage.value === 'hi'
      ? 'कृपया अपनी फोटो अपलोड करें।'
      : 'Please provide your photo.';
    return false;
  }

  isSubmittingWorker.value = true;
  workerSubmitError.value = null;
  workerSubmitSuccess.value = false;

  try {
    const payload: Record<string, string> = {
      fullName: name,
      categoryId,
    };
    if (front) {
      payload.aadhaarFrontBase64 = front.base64;
      payload.aadhaarFrontMime = front.mime;
    }
    if (back) {
      payload.aadhaarBackBase64 = back.base64;
      payload.aadhaarBackMime = back.mime;
    }
    if (photo) {
      payload.photoBase64 = photo.base64;
      payload.photoMime = photo.mime;
    }

    const res = await fetch('/api/worker/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body: ApiResponse<{
      status: 'PENDING_VERIFICATION';
      submittedAt: string;
      messageEn: string;
      messageHi: string;
    }> = await res.json();

    if (res.ok && body.success && body.data) {
      workerStatus.value = 'PENDING_VERIFICATION';
      rejectionReason.value = null;
      rejectedAt.value = null;
      existingHasFront.value = true;
      existingHasBack.value = true;
      existingHasPhoto.value = true;
      workerSubmitSuccess.value = true;
      // Clear sensitive memory immediately
      aadhaarFront.value = null;
      aadhaarBack.value = null;
      workerPhoto.value = null;
      return true;
    } else {
      if (res.status === 401) {
        handleSessionExpired();
        return false;
      }
      workerSubmitError.value = currentLanguage.value === 'hi'
        ? (body.error?.messageHi || 'प्रोफ़ाइल सबमिट करने में विफल। कृपया पुनः प्रयास करें।')
        : (body.error?.messageEn || 'Failed to submit profile. Please try again.');
      return false;
    }
  } catch (err: any) {
    workerSubmitError.value = currentLanguage.value === 'hi'
      ? 'नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन जांचें।'
      : 'Network error. Please check your internet connection.';
    return false;
  } finally {
    isSubmittingWorker.value = false;
  }
}

/**
 * Fetches verified active workers for customer display.
 */
export async function fetchVerifiedWorkers(categoryId?: string): Promise<void> {
  verifiedWorkersLoading.value = true;
  verifiedWorkersError.value = null;

  try {
    const url = categoryId && categoryId.trim()
      ? `/api/workers/verified?category_id=${encodeURIComponent(categoryId.trim())}`
      : '/api/workers/verified';

    const res = await fetch(url);
    const data: ApiResponse<{ workers: VerifiedWorkerSummary[] }> = await res.json();

    if (res.ok && data.success && data.data) {
      verifiedWorkers.value = data.data.workers || [];
    } else {
      verifiedWorkersError.value = data.error?.messageEn || 'Failed to load workers';
    }
  } catch (err: any) {
    verifiedWorkersError.value = err?.message || 'Network error';
  } finally {
    verifiedWorkersLoading.value = false;
  }
}

export function resetWorkerSetup(): void {
  workerFullName.value = '';
  workerCategoryId.value = '';
  aadhaarFront.value = null;
  aadhaarBack.value = null;
  workerPhoto.value = null;
  rejectionReason.value = null;
  rejectedAt.value = null;
  existingHasFront.value = false;
  existingHasBack.value = false;
  existingHasPhoto.value = false;
  workerSubmitError.value = null;
  workerSubmitSuccess.value = false;
}
