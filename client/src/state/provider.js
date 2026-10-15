import { signal } from '@preact/signals';
import { authToken, logout } from './auth';
import { currentLanguage, t } from './language';
export const providerJobs = signal([]);
export const isProviderJobsLoading = signal(false);
export const providerJobsError = signal(null);
export const selectedJobId = signal(null);
export const activeJobDetail = signal(null);
export const isJobDetailLoading = signal(false);
export const jobDetailError = signal(null);
export const isPlayingJobAudio = signal(false);
export const jobAudioError = signal(null);
export const isAcceptingJob = signal(false);
export const jobAcceptError = signal(null);
export const jobAcceptSuccess = signal(false);
export const isRejectingJob = signal(false);
export const jobRejectError = signal(null);
export const jobRejectSuccess = signal(false);
export const isUpdatingStatus = signal(false);
export const statusUpdateError = signal(null);
export const statusUpdateSuccess = signal(false);
// Module 11: Payment collection signals
export const isCollectingPayment = signal(false);
export const paymentCollectError = signal(null);
export const paymentCollectSuccess = signal(false);
let activeAudioElement = null;
let currentJobAudioObjectUrl = null;
export function stopJobAudio() {
    if (activeAudioElement) {
        try {
            activeAudioElement.pause();
            activeAudioElement.currentTime = 0;
        }
        catch {
            // Ignore pause failures
        }
        activeAudioElement = null;
    }
    if (currentJobAudioObjectUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
        try {
            URL.revokeObjectURL(currentJobAudioObjectUrl);
        }
        catch {
            // Ignore
        }
        currentJobAudioObjectUrl = null;
    }
    isPlayingJobAudio.value = false;
    jobAudioError.value = null;
}
export async function toggleJobAudio(audioUrl) {
    jobAudioError.value = null;
    if (isPlayingJobAudio.value && activeAudioElement) {
        stopJobAudio();
        return;
    }
    stopJobAudio();
    try {
        const token = authToken.value;
        const res = await fetch(audioUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
            jobAudioError.value = t('provider.audio_playback_error');
            return;
        }
        const blob = await res.blob();
        const objectUrl = (typeof URL !== 'undefined' && URL.createObjectURL)
            ? URL.createObjectURL(blob)
            : audioUrl;
        currentJobAudioObjectUrl = objectUrl;
        const audio = new Audio(objectUrl);
        activeAudioElement = audio;
        audio.onended = () => {
            stopJobAudio();
        };
        audio.onerror = () => {
            stopJobAudio();
            jobAudioError.value = t('provider.audio_playback_error');
        };
        await audio.play();
        isPlayingJobAudio.value = true;
    }
    catch {
        stopJobAudio();
        jobAudioError.value = t('provider.audio_playback_error');
    }
}
export async function fetchProviderJobs() {
    const token = authToken.value;
    if (!token)
        return;
    isProviderJobsLoading.value = true;
    providerJobsError.value = null;
    try {
        const res = await fetch('/api/provider/jobs', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            await logout();
            return;
        }
        const body = await res.json();
        if (!res.ok || !body.success) {
            providerJobsError.value =
                currentLanguage.value === 'hi'
                    ? (body.error?.messageHi || 'उपलब्ध काम लोड करने में असमर्थ।')
                    : (body.error?.messageEn || 'Unable to load available jobs.');
            return;
        }
        providerJobs.value = body.data || [];
    }
    catch {
        providerJobsError.value = t('provider.load_error');
    }
    finally {
        isProviderJobsLoading.value = false;
    }
}
export async function fetchJobDetail(jobId) {
    const token = authToken.value;
    if (!token)
        return;
    isJobDetailLoading.value = true;
    jobDetailError.value = null;
    try {
        const res = await fetch(`/api/provider/jobs/${jobId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (res.status === 401) {
            await logout();
            return;
        }
        const body = await res.json();
        if (!res.ok || !body.success) {
            jobDetailError.value =
                currentLanguage.value === 'hi'
                    ? (body.error?.messageHi || 'काम का विवरण लोड करने में असमर्थ।')
                    : (body.error?.messageEn || 'Unable to load job details.');
            return;
        }
        activeJobDetail.value = body.data || null;
    }
    catch {
        jobDetailError.value = t('provider.load_error');
    }
    finally {
        isJobDetailLoading.value = false;
    }
}
export function openJobDetail(jobId) {
    stopJobAudio();
    selectedJobId.value = jobId;
    activeJobDetail.value = null;
    jobAcceptError.value = null;
    jobAcceptSuccess.value = false;
    jobRejectError.value = null;
    jobRejectSuccess.value = false;
    statusUpdateError.value = null;
    statusUpdateSuccess.value = false;
    paymentCollectError.value = null;
    paymentCollectSuccess.value = false;
    fetchJobDetail(jobId);
}
export function closeJobDetail() {
    stopJobAudio();
    selectedJobId.value = null;
    activeJobDetail.value = null;
    jobDetailError.value = null;
    jobAcceptError.value = null;
    jobAcceptSuccess.value = false;
    jobRejectError.value = null;
    jobRejectSuccess.value = false;
    statusUpdateError.value = null;
    statusUpdateSuccess.value = false;
    paymentCollectError.value = null;
    paymentCollectSuccess.value = false;
}
export async function acceptJob(jobId) {
    const token = authToken.value;
    if (!token)
        return false;
    isAcceptingJob.value = true;
    jobAcceptError.value = null;
    jobAcceptSuccess.value = false;
    jobRejectError.value = null;
    jobRejectSuccess.value = false;
    try {
        const res = await fetch(`/api/provider/jobs/${jobId}/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: '{}',
        });
        if (res.status === 401) {
            await logout();
            return false;
        }
        const body = await res.json();
        if (!res.ok || !body.success) {
            if (res.status === 409) {
                jobAcceptError.value =
                    currentLanguage.value === 'hi'
                        ? (body.error?.messageHi || 'यह काम पहले ही किसी अन्य मिस्त्री द्वारा स्वीकार कर लिया गया है।')
                        : (body.error?.messageEn || 'This job was already accepted by another technician.');
            }
            else {
                jobAcceptError.value =
                    currentLanguage.value === 'hi'
                        ? (body.error?.messageHi || 'काम स्वीकार करने में असमर्थ। कृपया पुनः प्रयास करें।')
                        : (body.error?.messageEn || 'Unable to accept job. Please try again.');
            }
            // Reconcile with server: refresh job detail and available job feed
            await fetchJobDetail(jobId);
            await fetchProviderJobs();
            return false;
        }
        // Success: update active detail to server-confirmed state
        if (body.data) {
            activeJobDetail.value = body.data;
        }
        jobAcceptSuccess.value = true;
        // Refresh feed from server so the claimed job disappears from available jobs
        await fetchProviderJobs();
        return true;
    }
    catch {
        jobAcceptError.value = t('provider.accept_failed');
        return false;
    }
    finally {
        isAcceptingJob.value = false;
    }
}
export async function rejectJob(jobId) {
    const token = authToken.value;
    if (!token)
        return false;
    isRejectingJob.value = true;
    jobRejectError.value = null;
    jobRejectSuccess.value = false;
    jobAcceptError.value = null;
    jobAcceptSuccess.value = false;
    try {
        const res = await fetch(`/api/provider/jobs/${jobId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: '{}',
        });
        if (res.status === 401) {
            await logout();
            return false;
        }
        const body = await res.json();
        if (!res.ok || !body.success) {
            if (res.status === 409) {
                jobRejectError.value =
                    currentLanguage.value === 'hi'
                        ? (body.error?.messageHi || 'यह काम आपको सौंपा नहीं गया है या इसे छोड़ा नहीं जा सकता।')
                        : (body.error?.messageEn || 'This job is not assigned to you or cannot be relinquished.');
            }
            else {
                jobRejectError.value =
                    currentLanguage.value === 'hi'
                        ? (body.error?.messageHi || 'काम छोड़ने में विफल। कृपया पुनः प्रयास करें।')
                        : (body.error?.messageEn || 'Unable to relinquish job. Please try again.');
            }
            // Reconcile with server: refresh job detail and feed
            await fetchJobDetail(jobId);
            await fetchProviderJobs();
            return false;
        }
        // Success: update active detail to server-confirmed state (now SERVICE_REQUESTED)
        if (body.data) {
            activeJobDetail.value = body.data;
        }
        jobRejectSuccess.value = true;
        // Refresh feed from server so the relinquished job reappears in the available jobs
        await fetchProviderJobs();
        return true;
    }
    catch {
        jobRejectError.value = t('provider.reject_failed');
        return false;
    }
    finally {
        isRejectingJob.value = false;
    }
}
export async function updateJobStatus(jobId, status) {
    const token = authToken.value;
    if (!token)
        return false;
    isUpdatingStatus.value = true;
    statusUpdateError.value = null;
    statusUpdateSuccess.value = false;
    try {
        const res = await fetch(`/api/provider/jobs/${jobId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status }),
        });
        if (res.status === 401) {
            await logout();
            return false;
        }
        const body = await res.json();
        if (!res.ok || !body.success) {
            if (res.status === 409) {
                statusUpdateError.value =
                    currentLanguage.value === 'hi'
                        ? (body.error?.messageHi || 'यह स्थिति बदलाव संभव नहीं है या पहले ही पूरा हो चुका है।')
                        : (body.error?.messageEn || 'Status transition not permitted or already updated.');
            }
            else {
                statusUpdateError.value =
                    currentLanguage.value === 'hi'
                        ? (body.error?.messageHi || 'स्थिति अपडेट करने में विफल। कृपया पुनः प्रयास करें।')
                        : (body.error?.messageEn || 'Unable to update status. Please try again.');
            }
            // Reconcile with server: refresh job detail
            await fetchJobDetail(jobId);
            return false;
        }
        // Success: update active detail to server-confirmed state
        if (body.data) {
            activeJobDetail.value = body.data;
        }
        statusUpdateSuccess.value = true;
        return true;
    }
    catch {
        statusUpdateError.value = t('provider.status_update_failed');
        return false;
    }
    finally {
        isUpdatingStatus.value = false;
    }
}
export async function collectCashPayment(jobId) {
    const token = authToken.value;
    if (!token)
        return false;
    isCollectingPayment.value = true;
    paymentCollectError.value = null;
    paymentCollectSuccess.value = false;
    try {
        const res = await fetch(`/api/provider/jobs/${jobId}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: '{}',
        });
        if (res.status === 401) {
            await logout();
            return false;
        }
        const body = await res.json();
        if (!res.ok || !body.success) {
            if (res.status === 409) {
                paymentCollectError.value =
                    currentLanguage.value === 'hi'
                        ? (body.error?.messageHi || 'भुगतान पहले ही दर्ज किया जा चुका है।')
                        : (body.error?.messageEn || 'Payment has already been recorded.');
            }
            else {
                paymentCollectError.value =
                    currentLanguage.value === 'hi'
                        ? (body.error?.messageHi || 'नकद भुगतान दर्ज करने में असमर्थ। कृपया पुनः प्रयास करें।')
                        : (body.error?.messageEn || 'Unable to confirm cash collection. Please try again.');
            }
            // Reconcile with server: refresh job detail to reflect current state
            await fetchJobDetail(jobId);
            return false;
        }
        // Success: update active detail to server-confirmed PAYMENT_COLLECTED state
        if (body.data) {
            activeJobDetail.value = body.data;
        }
        paymentCollectSuccess.value = true;
        return true;
    }
    catch {
        paymentCollectError.value = t('provider.payment_collect_failed');
        return false;
    }
    finally {
        isCollectingPayment.value = false;
    }
}
export function refreshCurrentJob() {
    if (selectedJobId.value) {
        fetchJobDetail(selectedJobId.value);
    }
}
export function refreshProviderJobs() {
    fetchProviderJobs();
}
