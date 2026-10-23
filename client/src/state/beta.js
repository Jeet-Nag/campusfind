import { signal } from '@preact/signals';
import { getApiUrl } from '../config/api';
// Signals
export const currentBetaPage = signal('home');
export const latestRelease = signal(null);
export const releasesList = signal([]);
export const isReleasesLoading = signal(false);
export const releaseError = signal(null);
export const feedbackList = signal([]);
export const feedbackTotal = signal(0);
export const isFeedbackLoading = signal(false);
export const feedbackError = signal(null);
export const selectedFeedback = signal(null);
export const selectedFeedbackComments = signal([]);
export const isCommentsLoading = signal(false);
export const selectedCategory = signal('');
export const selectedStatus = signal('');
export const feedbackSearch = signal('');
export const feedbackSort = signal('newest');
export const submissionSuccess = signal(null);
export const submissionError = signal(null);
export const isSubmitting = signal(false);
/**
 * Loads the latest published release.
 */
export async function fetchLatestRelease() {
    try {
        isReleasesLoading.value = true;
        releaseError.value = null;
        const res = await fetch(getApiUrl('/api/beta/releases/latest'));
        const json = await res.json();
        if (json.success && json.data) {
            latestRelease.value = json.data.release;
        }
        else {
            latestRelease.value = null;
        }
    }
    catch (err) {
        releaseError.value = err.message || 'Failed to load latest release';
    }
    finally {
        isReleasesLoading.value = false;
    }
}
/**
 * Loads all published and withdrawn releases for the archive.
 */
export async function fetchReleasesList() {
    try {
        isReleasesLoading.value = true;
        releaseError.value = null;
        const res = await fetch(getApiUrl('/api/beta/releases'));
        const json = await res.json();
        if (json.success && json.data) {
            releasesList.value = json.data.releases;
        }
    }
    catch (err) {
        releaseError.value = err.message || 'Failed to load releases';
    }
    finally {
        isReleasesLoading.value = false;
    }
}
/**
 * Loads public feedback discussions with search, filter, and pagination.
 */
export async function fetchFeedbackList(page = 0, limit = 20) {
    try {
        isFeedbackLoading.value = true;
        feedbackError.value = null;
        const params = new URLSearchParams();
        if (selectedCategory.value)
            params.set('category', selectedCategory.value);
        if (selectedStatus.value)
            params.set('status', selectedStatus.value);
        if (feedbackSearch.value)
            params.set('search', feedbackSearch.value);
        if (feedbackSort.value)
            params.set('sort', feedbackSort.value);
        params.set('offset', String(page * limit));
        params.set('limit', String(limit));
        const res = await fetch(getApiUrl(`/api/beta/feedback?${params.toString()}`));
        const json = await res.json();
        if (json.success && json.data) {
            feedbackList.value = json.data.items;
            feedbackTotal.value = json.data.total;
        }
    }
    catch (err) {
        feedbackError.value = err.message || 'Failed to load feedback';
    }
    finally {
        isFeedbackLoading.value = false;
    }
}
/**
 * Loads a single feedback discussion and its comments.
 */
export async function fetchFeedbackDetail(id) {
    try {
        isCommentsLoading.value = true;
        feedbackError.value = null;
        const res = await fetch(getApiUrl(`/api/beta/feedback/${id}`));
        const json = await res.json();
        if (json.success && json.data) {
            selectedFeedback.value = json.data.feedback;
            selectedFeedbackComments.value = json.data.comments;
            return true;
        }
        return false;
    }
    catch (err) {
        feedbackError.value = err.message || 'Failed to load feedback details';
        return false;
    }
    finally {
        isCommentsLoading.value = false;
    }
}
/**
 * Submits a new tester bug report or suggestion.
 */
export async function submitBetaFeedback(input) {
    try {
        isSubmitting.value = true;
        submissionError.value = null;
        submissionSuccess.value = null;
        const res = await fetch(getApiUrl('/api/beta/feedback'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const json = await res.json();
        if (json.success) {
            submissionSuccess.value = 'Feedback submitted successfully.';
            // Refresh list in background
            fetchFeedbackList();
            return true;
        }
        else {
            submissionError.value = json.error?.messageEn || 'Failed to submit feedback.';
            return false;
        }
    }
    catch (err) {
        submissionError.value = err.message || 'Network error while submitting.';
        return false;
    }
    finally {
        isSubmitting.value = false;
    }
}
/**
 * Adds a comment or reply to a feedback post.
 */
export async function submitComment(feedbackId, authorName, message, parentCommentId) {
    try {
        isSubmitting.value = true;
        submissionError.value = null;
        const res = await fetch(getApiUrl(`/api/beta/feedback/${feedbackId}/comments`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authorName, message, parentCommentId }),
        });
        const json = await res.json();
        if (json.success && json.data) {
            selectedFeedbackComments.value = [...selectedFeedbackComments.value, json.data.comment];
            if (selectedFeedback.value) {
                selectedFeedback.value = {
                    ...selectedFeedback.value,
                    commentsCount: selectedFeedback.value.commentsCount + 1,
                };
            }
            return true;
        }
        else {
            submissionError.value = json.error?.messageEn || 'Failed to post reply.';
            return false;
        }
    }
    catch (err) {
        submissionError.value = err.message || 'Network error while posting reply.';
        return false;
    }
    finally {
        isSubmitting.value = false;
    }
}
/**
 * Reports a feedback item as inappropriate.
 */
export async function reportFeedbackItem(feedbackId) {
    try {
        const res = await fetch(getApiUrl(`/api/beta/feedback/${feedbackId}/report`), {
            method: 'POST',
        });
        const json = await res.json();
        return !!json.success;
    }
    catch {
        return false;
    }
}
export function navigateBeta(page, feedbackId) {
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
