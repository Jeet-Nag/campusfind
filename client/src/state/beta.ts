import { signal } from '@preact/signals';
import { AppRelease, BetaFeedback, BetaFeedbackComment, BetaFeedbackCategory, BetaFeedbackStatus, BetaTesterRole, ApiResponse } from '@shared';
import { getApiUrl } from '../config/api';

export type BetaPageView = 'home' | 'download' | 'feedback' | 'submit-feedback' | 'feedback-detail';

// Signals
export const currentBetaPage = signal<BetaPageView>('home');
export const latestRelease = signal<AppRelease | null>(null);
export const releasesList = signal<AppRelease[]>([]);
export const isReleasesLoading = signal<boolean>(false);
export const releaseError = signal<string | null>(null);

export const feedbackList = signal<BetaFeedback[]>([]);
export const feedbackTotal = signal<number>(0);
export const isFeedbackLoading = signal<boolean>(false);
export const feedbackError = signal<string | null>(null);

export const selectedFeedback = signal<BetaFeedback | null>(null);
export const selectedFeedbackComments = signal<BetaFeedbackComment[]>([]);
export const isCommentsLoading = signal<boolean>(false);

export const selectedCategory = signal<string>('');
export const selectedStatus = signal<string>('');
export const feedbackSearch = signal<string>('');
export const feedbackSort = signal<'newest' | 'most_discussed'>('newest');

export const submissionSuccess = signal<string | null>(null);
export const submissionError = signal<string | null>(null);
export const isSubmitting = signal<boolean>(false);

/**
 * Loads the latest published release.
 */
export async function fetchLatestRelease(): Promise<void> {
  try {
    isReleasesLoading.value = true;
    releaseError.value = null;

    const res = await fetch(getApiUrl('/api/beta/releases/latest'));
    const json: ApiResponse<{ release: AppRelease | null }> = await res.json();

    if (json.success && json.data) {
      latestRelease.value = json.data.release;
    } else {
      latestRelease.value = null;
    }
  } catch (err: any) {
    releaseError.value = err.message || 'Failed to load latest release';
  } finally {
    isReleasesLoading.value = false;
  }
}

/**
 * Loads all published and withdrawn releases for the archive.
 */
export async function fetchReleasesList(): Promise<void> {
  try {
    isReleasesLoading.value = true;
    releaseError.value = null;

    const res = await fetch(getApiUrl('/api/beta/releases'));
    const json: ApiResponse<{ releases: AppRelease[] }> = await res.json();

    if (json.success && json.data) {
      releasesList.value = json.data.releases;
    }
  } catch (err: any) {
    releaseError.value = err.message || 'Failed to load releases';
  } finally {
    isReleasesLoading.value = false;
  }
}

/**
 * Loads public feedback discussions with search, filter, and pagination.
 */
export async function fetchFeedbackList(page = 0, limit = 20): Promise<void> {
  try {
    isFeedbackLoading.value = true;
    feedbackError.value = null;

    const params = new URLSearchParams();
    if (selectedCategory.value) params.set('category', selectedCategory.value);
    if (selectedStatus.value) params.set('status', selectedStatus.value);
    if (feedbackSearch.value) params.set('search', feedbackSearch.value);
    if (feedbackSort.value) params.set('sort', feedbackSort.value);
    params.set('offset', String(page * limit));
    params.set('limit', String(limit));

    const res = await fetch(getApiUrl(`/api/beta/feedback?${params.toString()}`));
    const json: ApiResponse<{ items: BetaFeedback[]; total: number }> = await res.json();

    if (json.success && json.data) {
      feedbackList.value = json.data.items;
      feedbackTotal.value = json.data.total;
    }
  } catch (err: any) {
    feedbackError.value = err.message || 'Failed to load feedback';
  } finally {
    isFeedbackLoading.value = false;
  }
}

/**
 * Loads a single feedback discussion and its comments.
 */
export async function fetchFeedbackDetail(id: string): Promise<boolean> {
  try {
    isCommentsLoading.value = true;
    feedbackError.value = null;

    const res = await fetch(getApiUrl(`/api/beta/feedback/${id}`));
    const json: ApiResponse<{ feedback: BetaFeedback; comments: BetaFeedbackComment[] }> = await res.json();

    if (json.success && json.data) {
      selectedFeedback.value = json.data.feedback;
      selectedFeedbackComments.value = json.data.comments;
      return true;
    }
    return false;
  } catch (err: any) {
    feedbackError.value = err.message || 'Failed to load feedback details';
    return false;
  } finally {
    isCommentsLoading.value = false;
  }
}

/**
 * Submits a new tester bug report or suggestion.
 */
export async function submitBetaFeedback(input: {
  title: string;
  description: string;
  category: BetaFeedbackCategory;
  appVersion: string;
  testerRole: BetaTesterRole;
  deviceModel?: string;
  androidVersion?: string;
  authorName: string;
  authorContact?: string;
  screenshotBase64?: string;
  screenshotMime?: string;
}): Promise<boolean> {
  try {
    isSubmitting.value = true;
    submissionError.value = null;
    submissionSuccess.value = null;

    const res = await fetch(getApiUrl('/api/beta/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const json: ApiResponse<{ feedback: BetaFeedback }> = await res.json();

    if (json.success) {
      submissionSuccess.value = 'Feedback submitted successfully.';
      // Refresh list in background
      fetchFeedbackList();
      return true;
    } else {
      submissionError.value = json.error?.messageEn || 'Failed to submit feedback.';
      return false;
    }
  } catch (err: any) {
    submissionError.value = err.message || 'Network error while submitting.';
    return false;
  } finally {
    isSubmitting.value = false;
  }
}

/**
 * Adds a comment or reply to a feedback post.
 */
export async function submitComment(
  feedbackId: string,
  authorName: string,
  message: string,
  parentCommentId?: string
): Promise<boolean> {
  try {
    isSubmitting.value = true;
    submissionError.value = null;

    const res = await fetch(getApiUrl(`/api/beta/feedback/${feedbackId}/comments`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName, message, parentCommentId }),
    });

    const json: ApiResponse<{ comment: BetaFeedbackComment }> = await res.json();

    if (json.success && json.data) {
      selectedFeedbackComments.value = [...selectedFeedbackComments.value, json.data.comment];
      if (selectedFeedback.value) {
        selectedFeedback.value = {
          ...selectedFeedback.value,
          commentsCount: selectedFeedback.value.commentsCount + 1,
        };
      }
      return true;
    } else {
      submissionError.value = json.error?.messageEn || 'Failed to post reply.';
      return false;
    }
  } catch (err: any) {
    submissionError.value = err.message || 'Network error while posting reply.';
    return false;
  } finally {
    isSubmitting.value = false;
  }
}

/**
 * Reports a feedback item as inappropriate.
 */
export async function reportFeedbackItem(feedbackId: string): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl(`/api/beta/feedback/${feedbackId}/report`), {
      method: 'POST',
    });
    const json: ApiResponse<{ success: boolean }> = await res.json();
    return !!json.success;
  } catch {
    return false;
  }
}

export function navigateBeta(page: BetaPageView, feedbackId?: string) {
  currentBetaPage.value = page;
  submissionError.value = null;
  submissionSuccess.value = null;
  if (page === 'feedback-detail' && feedbackId) {
    fetchFeedbackDetail(feedbackId);
  }
  // Scroll to top
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
