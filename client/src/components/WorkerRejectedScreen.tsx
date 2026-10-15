import { currentLanguage, selectLanguage, t } from '../state/language';
import { currentUser, logout } from '../state/auth';
import {
  rejectionReason,
  rejectedAt,
  existingHasFront,
  existingHasBack,
  existingHasPhoto,
  aadhaarFront,
  aadhaarBack,
  workerPhoto,
  isSubmittingWorker,
  workerSubmitError,
  submitWorkerOnboarding,
} from '../state/worker';
import { DocumentUploadCard } from './DocumentUploadCard';
import { AlertCircleIcon, SpinnerIcon, LogOutIcon } from './icons';

export function WorkerRejectedScreen() {
  const lang = currentLanguage.value || 'en';

  const handleResubmit = async () => {
    if (isSubmittingWorker.value) return;
    await submitWorkerOnboarding();
  };

  return (
    <div class="min-h-screen flex flex-col justify-between bg-background p-4">
      {/* 1. Top Header */}
      <header class="max-w-md mx-auto w-full flex items-center justify-between py-2 shrink-0">
        <div class="font-bold text-brand text-lg">{t('app.title')}</div>

        <div class="flex items-center space-x-2">
          {/* Language toggle */}
          <div class="flex items-center bg-surface p-1 rounded border border-border">
            <button
              type="button"
              onClick={() => selectLanguage('en')}
              class={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
                lang === 'en' ? 'bg-brand text-white' : 'text-text-sub hover:text-text-main'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => selectLanguage('hi')}
              class={`px-2.5 py-1 text-xs font-semibold rounded min-h-[32px] transition-colors ${
                lang === 'hi' ? 'bg-brand text-white' : 'text-text-sub hover:text-text-main'
              }`}
            >
              हिंदी
            </button>
          </div>

          {/* Logout button */}
          <button
            type="button"
            onClick={() => logout()}
            class="p-2 text-text-sub hover:text-danger rounded min-h-[40px] min-w-[40px] flex items-center justify-center border border-border"
            title={t('auth.logout')}
            aria-label={t('auth.logout')}
          >
            <LogOutIcon size={18} />
          </button>
        </div>
      </header>

      {/* 2. Main Body */}
      <main class="max-w-md mx-auto w-full my-auto space-y-4 py-4">
        {/* Rejection Alert Card */}
        <section class="bg-surface border border-red-300 rounded-lg p-5 shadow-xs space-y-3">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-danger shrink-0 mt-0.5">
              <AlertCircleIcon size={22} />
            </div>
            <div>
              <span class="inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-red-100 text-red-900 border border-red-300 uppercase tracking-wide">
                {t('admin.filter_rejected')}
              </span>
              <h1 class="text-base font-bold text-text-main pt-1 leading-snug">
                {t('onboarding.rejected_title')}
              </h1>
              <p class="text-xs text-text-sub mt-1 leading-relaxed">
                {t('onboarding.rejected_desc')}
              </p>
            </div>
          </div>

          {/* Prominent Rejection Reason Display */}
          <div class="p-3.5 rounded-lg bg-red-50/80 border border-red-200 text-xs space-y-1.5">
            <div class="font-bold text-red-900 uppercase tracking-wider text-[11px]">
              {t('onboarding.rejection_reason_label')}:
            </div>
            <div class="text-sm font-semibold text-danger leading-relaxed break-words">
              {rejectionReason.value || (lang === 'hi' ? 'दस्तावेज़ स्पष्ट नहीं हैं।' : 'Documents are not clear or incomplete.')}
            </div>
            {rejectedAt.value && (
              <div class="text-[10px] text-text-sub pt-1">
                {new Date(rejectedAt.value).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            )}
          </div>

          {currentUser.value && (
            <div class="text-xs text-text-sub pt-0.5">
              {t('auth.logged_in_as', { phone: `+91 ${currentUser.value.phone}` })}
            </div>
          )}
        </section>

        {/* Global Error Banner */}
        {workerSubmitError.value && (
          <div class="p-3.5 rounded-lg bg-red-50 border border-red-200 text-danger text-xs flex items-start gap-2 shadow-xs">
            <AlertCircleIcon size={16} class="shrink-0 mt-0.5" />
            <span class="leading-snug">{workerSubmitError.value}</span>
          </div>
        )}

        {/* Document Correction Cards */}
        <div class="space-y-3">
          {/* Card 1: Aadhaar Front */}
          <DocumentUploadCard
            title={t('onboarding.aadhaar_front_label')}
            subtitle={lang === 'hi' ? 'आधार कार्ड के सामने का स्पष्ट फोटो' : 'Clear photo of Aadhaar front'}
            imageState={aadhaarFront.value}
            onImageSelected={(st) => {
              aadhaarFront.value = st;
              workerSubmitError.value = null;
            }}
            onRetake={() => {
              aadhaarFront.value = null;
            }}
            isPhoto={false}
            hasExisting={existingHasFront.value}
            required
          />

          {/* Card 2: Aadhaar Back */}
          <DocumentUploadCard
            title={t('onboarding.aadhaar_back_label')}
            subtitle={lang === 'hi' ? 'आधार कार्ड के पीछे का स्पष्ट फोटो' : 'Clear photo of Aadhaar back'}
            imageState={aadhaarBack.value}
            onImageSelected={(st) => {
              aadhaarBack.value = st;
              workerSubmitError.value = null;
            }}
            onRetake={() => {
              aadhaarBack.value = null;
            }}
            isPhoto={false}
            hasExisting={existingHasBack.value}
            required
          />

          {/* Card 3: Worker Photo */}
          <DocumentUploadCard
            title={t('onboarding.photo_title')}
            subtitle={t('onboarding.photo_sub')}
            imageState={workerPhoto.value}
            onImageSelected={(st) => {
              workerPhoto.value = st;
              workerSubmitError.value = null;
            }}
            onRetake={() => {
              workerPhoto.value = null;
            }}
            isPhoto={true}
            hasExisting={existingHasPhoto.value}
            required
          />
        </div>

        {/* Action Button: Resubmit */}
        <div class="space-y-2 pt-2">
          <button
            type="button"
            id="worker-resubmit-btn"
            onClick={handleResubmit}
            disabled={isSubmittingWorker.value}
            class={`w-full min-h-[48px] px-6 py-3.5 font-bold rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 shadow-sm ${
              !isSubmittingWorker.value
                ? 'bg-action hover:bg-action-active text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmittingWorker.value ? (
              <>
                <SpinnerIcon size={18} class="animate-spin text-white" />
                <span>{t('onboarding.resubmitting')}</span>
              </>
            ) : (
              <span>{t('onboarding.resubmit_btn')}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => logout()}
            class="w-full min-h-[44px] px-4 py-2 text-xs font-semibold text-text-sub hover:text-danger hover:underline transition-colors flex items-center justify-center"
          >
            {t('auth.logout')}
          </button>
        </div>
      </main>

      {/* 3. Footer */}
      <footer class="max-w-md mx-auto w-full text-center py-3 text-xs text-text-sub shrink-0">
        <span>{t('home.service_area_label')}</span>
      </footer>
    </div>
  );
}
