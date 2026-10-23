import { useEffect } from 'preact/hooks';
import {
  currentBetaPage,
  latestRelease,
  fetchLatestRelease,
  fetchReleasesList,
  navigateBeta,
} from '../state/beta';
import { BetaHeader } from './BetaHeader';
import { BetaHero } from './BetaHero';
import { BetaDownloadView } from './BetaDownloadView';
import { BetaFeedbackView } from './BetaFeedbackView';
import { BetaSubmitFeedbackModal } from './BetaSubmitFeedbackModal';
import { BetaFeedbackDetailView } from './BetaFeedbackDetailView';
import { BetaFooter } from './BetaFooter';
import { t } from '../state/language';
import { getApiUrl } from '../config/api';

export function BetaApp() {
  const page = currentBetaPage.value;
  const currentRel = latestRelease.value;

  useEffect(() => {
    fetchLatestRelease();
    fetchReleasesList();

    // Route detection from URL path
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/download' || path.startsWith('/download/')) {
        navigateBeta('download');
      } else if (path === '/feedback' || path.startsWith('/feedback/')) {
        navigateBeta('feedback');
      }
    }
  }, []);

  return (
    <div class="min-h-screen flex flex-col bg-background text-text-main antialiased selection:bg-brand selection:text-white">
      <BetaHeader />

      <main class="flex-1">
        {page === 'home' && (
          <div>
            <BetaHero />

            {/* Hyperlocal Features Highlight Section */}
            <section class="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-12">
              <div class="text-center max-w-2xl mx-auto space-y-2">
                <span class="text-xs font-bold uppercase tracking-wider text-brand">
                  Engineered for Jharkhand
                </span>
                <h2 class="text-2xl sm:text-3xl font-black text-text-main tracking-tight">
                  Why We Are Building a Dedicated Hyperlocal App
                </h2>
                <p class="text-xs sm:text-sm text-text-sub leading-relaxed">
                  Rural and semi-urban households in Chandil struggle to find vetted electricians, plumbers, and mechanics with transparent pricing.
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-3">
                  <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                    ⚡
                  </div>
                  <h3 class="text-base font-bold text-text-main">
                    Works on 2G/3G & Low-End Phones
                  </h3>
                  <p class="text-xs text-text-sub leading-relaxed">
                    Designed to consume minimal mobile data and operate smoothly on ₹6,000–₹10,000 Android phones common in Jharkhand.
                  </p>
                </div>

                <div class="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-3">
                  <div class="w-10 h-10 rounded-lg bg-blue-100 text-brand flex items-center justify-center font-bold text-lg">
                    🎙️
                  </div>
                  <h3 class="text-base font-bold text-text-main">
                    Audio Voice Bookings & Hindi
                  </h3>
                  <p class="text-xs text-text-sub leading-relaxed">
                    Customers who find typing difficult can record a quick 20-second voice note describing the repair issue in Hindi or English.
                  </p>
                </div>

                <div class="bg-surface border border-border rounded-xl p-6 shadow-xs space-y-3">
                  <div class="w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-lg">
                    🛡️
                  </div>
                  <h3 class="text-base font-bold text-text-main">
                    Aadhaar-Verified Local Technicians
                  </h3>
                  <p class="text-xs text-text-sub leading-relaxed">
                    Every service provider is verified by local operations in Chandil with ID checks, physical background verification, and fixed visiting rates.
                  </p>
                </div>
              </div>

              {/* Beta Testing Flow Preview */}
              <div class="bg-gradient-to-r from-slate-900 to-brand-dark rounded-2xl p-6 sm:p-10 text-white space-y-6">
                <div class="max-w-xl space-y-2">
                  <span class="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    Beta Feedback Community
                  </span>
                  <h3 class="text-2xl font-bold">
                    Help Us Find Bugs Before Launch
                  </h3>
                  <p class="text-slate-300 text-xs sm:text-sm leading-relaxed">
                    Whether you are testing booking requests, the worker job feed, or screen performance on your phone, your reports directly guide development.
                  </p>
                </div>

                <div class="flex flex-wrap gap-3">
                  <button
                    onClick={() => navigateBeta('download')}
                    class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm"
                  >
                    Download Latest APK &rarr;
                  </button>
                  <button
                    onClick={() => navigateBeta('submit-feedback')}
                    class="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg border border-white/20"
                  >
                    Report an Issue
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {page === 'download' && <BetaDownloadView />}

        {page === 'feedback' && <BetaFeedbackView />}

        {page === 'submit-feedback' && <BetaSubmitFeedbackModal />}

        {page === 'feedback-detail' && <BetaFeedbackDetailView />}
      </main>

      <BetaFooter />
    </div>
  );
}
