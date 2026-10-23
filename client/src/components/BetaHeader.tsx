import { currentBetaPage, navigateBeta } from '../state/beta';
import { currentLanguage, selectLanguage, t } from '../state/language';

export function BetaHeader() {
  const page = currentBetaPage.value;
  const lang = currentLanguage.value || 'en';

  return (
    <header class="bg-brand-dark text-white sticky top-0 z-30 border-b border-slate-700/80 shadow-md backdrop-blur-sm bg-opacity-95">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Beta Badge */}
        <div class="flex items-center gap-3">
          <button
            onClick={() => navigateBeta('home')}
            class="flex items-center gap-2.5 text-left focus:outline-none group"
          >
            <div class="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center font-bold text-base shadow-inner border border-white/20 group-hover:scale-105 transition-transform">
              C
            </div>
            <div>
              <span class="font-bold text-white text-base tracking-tight block leading-tight">
                Chandil Home Services
              </span>
              <span class="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase block">
                {t('beta.portal_badge')}
              </span>
            </div>
          </button>
        </div>

        {/* Navigation Tabs (Desktop & Tablet) */}
        <nav class="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/60 text-xs font-medium">
          <button
            onClick={() => navigateBeta('home')}
            class={`px-3.5 py-1.5 rounded-md transition-colors ${
              page === 'home'
                ? 'bg-brand text-white font-semibold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {t('beta.nav_home')}
          </button>
          <button
            onClick={() => navigateBeta('download')}
            class={`px-3.5 py-1.5 rounded-md transition-colors ${
              page === 'download'
                ? 'bg-brand text-white font-semibold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {t('beta.nav_download')}
          </button>
          <button
            onClick={() => navigateBeta('feedback')}
            class={`px-3.5 py-1.5 rounded-md transition-colors ${
              page === 'feedback' || page === 'feedback-detail' || page === 'submit-feedback'
                ? 'bg-brand text-white font-semibold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {t('beta.nav_feedback')}
          </button>
        </nav>

        {/* Right Controls: Language toggle & Admin portal link */}
        <div class="flex items-center gap-2.5">
          {/* Language Switcher */}
          <div class="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => selectLanguage('en')}
              class={`min-h-[32px] px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                lang === 'en'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => selectLanguage('hi')}
              class={`min-h-[32px] px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                lang === 'hi'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              हिंदी
            </button>
          </div>

          {/* Admin link */}
          <a
            href="/admin"
            class="text-xs text-slate-300 hover:text-white font-medium border border-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors hidden sm:inline-block"
            title="Administrator Operations"
          >
            Admin Panel &rarr;
          </a>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div class="flex md:hidden border-t border-slate-800 bg-slate-900/90 px-4 py-2 justify-around text-xs font-medium">
        <button
          onClick={() => navigateBeta('home')}
          class={`px-3 py-1.5 rounded transition-colors ${
            page === 'home' ? 'text-white font-bold bg-slate-800' : 'text-slate-400'
          }`}
        >
          {t('beta.nav_home')}
        </button>
        <button
          onClick={() => navigateBeta('download')}
          class={`px-3 py-1.5 rounded transition-colors ${
            page === 'download' ? 'text-white font-bold bg-slate-800' : 'text-slate-400'
          }`}
        >
          {t('beta.nav_download')}
        </button>
        <button
          onClick={() => navigateBeta('feedback')}
          class={`px-3 py-1.5 rounded transition-colors ${
            page === 'feedback' || page === 'feedback-detail' || page === 'submit-feedback'
              ? 'text-white font-bold bg-slate-800'
              : 'text-slate-400'
          }`}
        >
          {t('beta.nav_feedback')}
        </button>
      </div>
    </header>
  );
}
