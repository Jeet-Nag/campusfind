import { useState } from 'preact/hooks';
import { workerStatusLoading, workerStatusError, fetchWorkerStatus } from '../state/worker';
import { currentUser, logout } from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { ClockIcon, SpinnerIcon, CheckIcon, LogOutIcon } from './icons';

export function WorkerPendingScreen() {
  const lang = currentLanguage.value || 'en';
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    if (workerStatusLoading.value) return;
    setFeedback(null);
    const newStatus = await fetchWorkerStatus();
    if (newStatus === 'VERIFIED') {
      // Authoritative user session refreshed, App routing automatically transitions to ProviderHome
      return;
    }
    if (newStatus === 'PENDING_VERIFICATION') {
      if (workerStatusError.value) {
        setFeedback(workerStatusError.value);
      } else {
        setFeedback(
          lang === 'hi'
            ? 'सत्यापन अभी भी लंबित है। एडमिन 24 घंटे के भीतर समीक्षा करेगा।'
            : 'Verification is still pending. Admin will review within 24 hours.'
        );
      }
      return;
    }
    // Failed request or network error
    setFeedback(
      workerStatusError.value ||
        (lang === 'hi'
          ? 'नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन जांचें।'
          : 'Network error. Please check your internet connection.')
    );
  };

  return (
    <div class="min-h-screen flex flex-col justify-between bg-background p-4">
      {/* Header with language toggle and logout */}
      <header class="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <div class="font-bold text-brand text-lg">{t('app.title')}</div>

        <div class="flex items-center space-x-2">
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

      {/* Main Pending Card */}
      <main class="max-w-md mx-auto w-full my-auto">
        <div class="bg-surface border border-border rounded-lg p-6 shadow-sm text-center space-y-4">
          <div class="w-16 h-16 mx-auto rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-amber-600">
            <ClockIcon size={32} />
          </div>

          <div class="space-y-1">
            <span class="inline-block px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide">
              PENDING VERIFICATION
            </span>
            <h1 class="text-lg font-bold text-text-main pt-2 leading-snug">
              {t('onboarding.pending_verification_title')}
            </h1>
          </div>

          <div class="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-text-main leading-relaxed text-left space-y-2">
            <p class="font-medium">
              {lang === 'hi'
                ? 'Aapka profile submit ho gaya hai, Chandil Admin 24 ghante me verify karega.'
                : 'Your profile has been submitted. Chandil Admin will verify it within 24 hours.'}
            </p>
            <p class="text-text-sub">
              {t('onboarding.pending_verification_desc')}
            </p>
          </div>

          {currentUser.value && (
            <div class="text-xs text-text-sub">
              {t('auth.logged_in_as', { phone: `+91 ${currentUser.value.phone}` })}
            </div>
          )}

          {feedback && (
            <div
              id="worker-pending-feedback"
              class={`p-3 rounded-lg text-xs flex items-center justify-center space-x-1.5 ${
                workerStatusError.value
                  ? 'bg-amber-50 border border-amber-200 text-amber-900'
                  : 'bg-blue-50 border border-blue-200 text-brand'
              }`}
            >
              <span>{feedback}</span>
            </div>
          )}

          <div class="space-y-2 pt-2">
            <button
              type="button"
              id="check-worker-status-btn"
              onClick={handleCheckStatus}
              disabled={workerStatusLoading.value}
              class="w-full min-h-[48px] px-4 py-3 bg-brand hover:bg-brand-dark text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center space-x-2"
            >
              {workerStatusLoading.value ? (
                <>
                  <SpinnerIcon size={18} class="text-white" />
                  <span>{lang === 'hi' ? 'जांच हो रही है...' : 'Checking...'}</span>
                </>
              ) : (
                <span>{t('onboarding.status_check_btn')}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              class="w-full min-h-[48px] px-4 py-2 text-xs font-semibold text-text-sub hover:text-danger hover:underline transition-colors flex items-center justify-center"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer class="max-w-md mx-auto w-full text-center py-3 text-xs text-text-sub">
        <span>{t('home.service_area_label')}</span>
      </footer>
    </div>
  );
}
