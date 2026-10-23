import { useState } from 'preact/hooks';
import {
  latestRelease,
  isSubmitting,
  submissionError,
  submissionSuccess,
  submitBetaFeedback,
  navigateBeta,
} from '../state/beta';
import { BetaFeedbackCategory, BetaTesterRole } from '@shared';
import { t } from '../state/language';

export function BetaSubmitFeedbackModal() {
  const currentRel = latestRelease.value;
  const submitting = isSubmitting.value;
  const error = submissionError.value;
  const success = submissionSuccess.value;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BetaFeedbackCategory>('BUG_REPORT');
  const [appVersion, setAppVersion] = useState(currentRel?.versionDisplay || 'v1');
  const [testerRole, setTesterRole] = useState<BetaTesterRole>('customer');
  const [deviceModel, setDeviceModel] = useState('');
  const [androidVersion, setAndroidVersion] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | undefined>(undefined);
  const [screenshotMime, setScreenshotMime] = useState<string | undefined>(undefined);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleScreenshotChange = (e: any) => {
    setLocalError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLocalError('Only image files (PNG, JPEG, WebP) are accepted.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLocalError('Image file must not exceed 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setScreenshotBase64(result);
      setScreenshotMime(file.type);
      setScreenshotPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = () => {
    setScreenshotBase64(undefined);
    setScreenshotMime(undefined);
    setScreenshotPreview(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLocalError(null);

    if (!title.trim() || title.trim().length < 3) {
      setLocalError('Please enter a descriptive title (at least 3 characters).');
      return;
    }

    if (!description.trim() || description.trim().length < 5) {
      setLocalError('Please enter a description explaining what happened (at least 5 characters).');
      return;
    }

    if (!authorName.trim()) {
      setLocalError('Please enter your name.');
      return;
    }

    const ok = await submitBetaFeedback({
      title: title.trim(),
      description: description.trim(),
      category,
      appVersion,
      testerRole,
      deviceModel: deviceModel.trim() || undefined,
      androidVersion: androidVersion.trim() || undefined,
      authorName: authorName.trim(),
      screenshotBase64,
      screenshotMime,
    });

    if (ok) {
      setTimeout(() => {
        navigateBeta('feedback');
      }, 1500);
    }
  };

  return (
    <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <button onClick={() => navigateBeta('feedback')} class="hover:text-brand cursor-pointer">
          &larr; Back to Feedback Board
        </button>
      </div>

      <div class="bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-text-main">
            {t('beta.submit_feedback_title')}
          </h1>
          <p class="text-xs text-text-sub mt-1">
            Report issues, UI glitches, or suggest improvements to help the Chandil team polish the app.
          </p>
        </div>

        {/* Success Banner */}
        {success && (
          <div class="p-4 rounded-lg bg-green-50 border border-green-200 text-action text-xs font-semibold flex items-center gap-2">
            <span>✓</span>
            <span>{t('beta.form_success')}</span>
          </div>
        )}

        {/* Error Banner */}
        {(localError || error) && (
          <div class="p-4 rounded-lg bg-red-50 border border-red-200 text-danger text-xs font-medium flex items-center gap-2">
            <span>⚠️</span>
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-5">
          {/* Title */}
          <div>
            <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
              {t('beta.form_title')} <span class="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={t('beta.form_title_placeholder')}
              value={title}
              onInput={(e: any) => setTitle(e.target.value)}
              disabled={submitting}
              class="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand"
            />
          </div>

          {/* Category & Tested Version */}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                {t('beta.form_category')}
              </label>
              <select
                value={category}
                onChange={(e: any) => setCategory(e.target.value)}
                disabled={submitting}
                class="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand"
              >
                <option value="BUG_REPORT">Bug Report</option>
                <option value="UI_DESIGN">UI / Design Polish</option>
                <option value="PERFORMANCE">Performance & Slowness</option>
                <option value="AUTH">Login & Authentication</option>
                <option value="BOOKING">Booking Flow</option>
                <option value="WORKER_EXPERIENCE">Worker Experience</option>
                <option value="FEATURE_REQUEST">Feature Request</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                {t('beta.form_app_version')}
              </label>
              <input
                type="text"
                value={appVersion}
                onInput={(e: any) => setAppVersion(e.target.value)}
                disabled={submitting}
                placeholder="e.g. v1"
                class="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
              {t('beta.form_desc')} <span class="text-danger">*</span>
            </label>
            <textarea
              required
              rows={5}
              placeholder={t('beta.form_desc_placeholder')}
              value={description}
              onInput={(e: any) => setDescription(e.target.value)}
              disabled={submitting}
              class="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand leading-relaxed"
            ></textarea>
          </div>

          {/* Role, Device, Android Version */}
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                {t('beta.form_role')}
              </label>
              <select
                value={testerRole}
                onChange={(e: any) => setTesterRole(e.target.value)}
                disabled={submitting}
                class="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand font-semibold"
              >
                <option value="customer">{t('beta.form_role_customer')}</option>
                <option value="worker">{t('beta.form_role_worker')}</option>
                <option value="both">{t('beta.form_role_both')}</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                {t('beta.form_device')}
              </label>
              <input
                type="text"
                placeholder="e.g. Redmi 9A"
                value={deviceModel}
                onInput={(e: any) => setDeviceModel(e.target.value)}
                disabled={submitting}
                class="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
                {t('beta.form_android_ver')}
              </label>
              <input
                type="text"
                placeholder="e.g. Android 11"
                value={androidVersion}
                onInput={(e: any) => setAndroidVersion(e.target.value)}
                disabled={submitting}
                class="w-full px-3 py-2.5 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Tester Name */}
          <div>
            <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
              {t('beta.form_name')} <span class="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Kumar"
              value={authorName}
              onInput={(e: any) => setAuthorName(e.target.value)}
              disabled={submitting}
              class="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand"
            />
          </div>

          {/* Optional Screenshot */}
          <div>
            <label class="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
              {t('beta.form_screenshot')}
            </label>

            {screenshotPreview ? (
              <div class="flex items-center gap-4 p-3 bg-slate-50 border border-border rounded-lg">
                <img
                  src={screenshotPreview}
                  alt="Attachment preview"
                  class="w-16 h-16 object-cover rounded border border-border"
                />
                <div class="flex-1 text-xs text-text-sub">
                  <span class="font-medium text-text-main block">Image attached</span>
                  <span class="text-[11px]">Ready for upload</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveScreenshot}
                  class="text-xs text-danger hover:underline font-semibold"
                >
                  Remove
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleScreenshotChange}
                disabled={submitting}
                class="w-full text-xs text-text-sub file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-brand hover:file:bg-slate-200 cursor-pointer"
              />
            )}
          </div>

          {/* Submit Action */}
          <div class="pt-4 flex items-center justify-end gap-3 border-t border-border">
            <button
              type="button"
              onClick={() => navigateBeta('feedback')}
              disabled={submitting}
              class="min-h-[44px] px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-sub hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              class="min-h-[44px] px-6 py-2.5 bg-brand hover:bg-brand-dark active:bg-slate-900 text-white font-bold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{t('beta.form_submitting')}</span>
                </>
              ) : (
                <span>{t('beta.form_submit_btn')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
