import { useEffect } from 'preact/hooks';
import { currentUser, logout } from '../state/auth';
import { currentLanguage, selectLanguage, t } from '../state/language';
import {
  adminActiveTab,
  setAdminTab,
  isAdminLoading,
  adminError,
  verifyAdminSession,
} from '../state/admin';
import {
  LogOutIcon,
  SpinnerIcon,
  AlertCircleIcon,
  CheckIcon,
  ToolIcon,
  FileTextIcon,
  RefreshIcon,
  ChevronRightIcon,
  UsersIcon,
} from './icons';
import { AdminProvidersView } from './AdminProvidersView';
import { AdminBookingsView } from './AdminBookingsView';
import { AdminUsersView } from './AdminUsersView';
import { AdminReleasesView } from './AdminReleasesView';
import { AdminFeedbackView } from './AdminFeedbackView';

export function AdminShell() {
  const user = currentUser.value;
  const lang = currentLanguage.value || 'en';
  const activeTab = adminActiveTab.value;
  const loading = isAdminLoading.value;
  const error = adminError.value;

  useEffect(() => {
    verifyAdminSession();
  }, []);

  // Strict check: if client-side user object is not admin, do not render admin shell
  if (user?.role !== 'admin' || error === 'ACCESS_DENIED') {
    return (
      <div class="min-h-screen flex items-center justify-center p-4 bg-background">
        <div class="w-full max-w-md bg-surface border border-border rounded-lg p-6 shadow-sm text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-danger">
            <AlertCircleIcon size={28} />
          </div>
          <h2 class="text-xl font-bold text-text-main mb-2">
            {t('admin.access_denied_title')}
          </h2>
          <p class="text-sm text-text-sub mb-6">
            {t('admin.access_denied_desc')}
          </p>
          <button
            onClick={() => logout()}
            class="w-full min-h-[48px] px-4 py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand-dark transition-colors"
          >
            {t('admin.logout')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex flex-col bg-background text-text-main">
      {/* Header */}
      <header class="bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div class="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Brand & Admin Badge */}
          <div class="flex items-center gap-3">
            <div>
              <h1 class="text-lg md:text-xl font-bold leading-tight">
                {t('app.title')}
              </h1>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-white/20 text-white">
                  {t('admin.role_badge')}
                </span>
                <span class="text-xs text-white/80 hidden sm:inline">
                  {user.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Right Controls: Language toggle & Logout */}
          <div class="flex items-center gap-2">
            {/* Language Switcher */}
            <div class="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/20">
              <button
                onClick={() => selectLanguage('en')}
                class={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  lang === 'en'
                    ? 'bg-white text-brand shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
                aria-label="Switch to English"
              >
                EN
              </button>
              <button
                onClick={() => selectLanguage('hi')}
                class={`min-h-[44px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  lang === 'hi'
                    ? 'bg-white text-brand shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
                aria-label="हिंदी में बदलें"
              >
                हिंदी
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => logout()}
              class="min-h-[48px] px-3 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg text-white text-xs font-medium flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
              title={t('admin.logout')}
              aria-label={t('admin.logout')}
            >
              <LogOutIcon size={16} />
              <span class="hidden sm:inline">{t('admin.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav class="bg-surface border-b border-border sticky top-[60px] z-9">
        <div class="max-w-5xl mx-auto px-4 flex gap-1">
          <button
            onClick={() => setAdminTab('dashboard')}
            class={`min-h-[48px] px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-sub hover:text-text-main hover:border-border'
            }`}
          >
            <span>{t('admin.dashboard')}</span>
          </button>

          <button
            onClick={() => setAdminTab('providers')}
            class={`min-h-[48px] px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'providers'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-sub hover:text-text-main hover:border-border'
            }`}
          >
            <span>{t('admin.providers')}</span>
          </button>

          <button
            onClick={() => setAdminTab('bookings')}
            class={`min-h-[48px] px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'bookings'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-sub hover:text-text-main hover:border-border'
            }`}
          >
            <span>{t('admin.bookings')}</span>
          </button>

          <button
            onClick={() => setAdminTab('users')}
            class={`min-h-[48px] px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-sub hover:text-text-main hover:border-border'
            }`}
          >
            <span>{t('admin.users')}</span>
          </button>

          <button
            onClick={() => setAdminTab('releases')}
            class={`min-h-[48px] px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'releases'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-sub hover:text-text-main hover:border-border'
            }`}
          >
            <span>{t('beta.admin_releases_tab')}</span>
          </button>

          <button
            onClick={() => setAdminTab('feedback')}
            class={`min-h-[48px] px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'feedback'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-sub hover:text-text-main hover:border-border'
            }`}
          >
            <span>{t('beta.admin_feedback_tab')}</span>
          </button>

          <a
            href="/beta"
            target="_blank"
            rel="noopener noreferrer"
            class="min-h-[48px] px-3 py-3 text-xs font-semibold text-text-sub hover:text-brand flex items-center gap-1 ml-auto"
            title="Open Public Beta Portal in new tab"
          >
            <span>Beta Portal</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </nav>

      {/* Main Content Area */}
      <main class="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6">
        {/* Loading State */}
        {loading && (
          <div class="flex items-center justify-center py-12">
            <div class="flex flex-col items-center gap-3">
              <SpinnerIcon size={32} class="text-brand animate-spin" />
              <p class="text-sm text-text-sub">{t('admin.loading')}</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div class="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircleIcon size={20} class="text-danger mt-0.5 shrink-0" />
            <div class="flex-1">
              <h3 class="text-sm font-bold text-danger">
                {t('admin.error_title')}
              </h3>
              <p class="text-xs text-text-sub mt-1">
                {error === 'NETWORK_ERROR'
                  ? t('app.network_error')
                  : t('admin.error_title')}
              </p>
              <button
                onClick={() => verifyAdminSession()}
                class="mt-3 min-h-[44px] px-3 py-1.5 bg-white border border-border rounded text-xs font-semibold text-text-main hover:bg-background flex items-center gap-1.5"
              >
                <RefreshIcon size={14} />
                <span>{t('admin.retry')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Dashboard View */}
        {!loading && activeTab === 'dashboard' && (
          <div class="space-y-6">
            <div>
              <h2 class="text-xl font-bold text-text-main">
                {t('admin.dashboard')}
              </h2>
              <p class="text-sm text-text-sub mt-0.5">
                {t('app.tagline')}
              </p>
            </div>

            {/* System Status Card (Honest operational state, zero fake metrics) */}
            <div class="bg-surface border border-border rounded-lg p-5 shadow-xs">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-text-main uppercase tracking-wider">
                  {t('admin.system_status')}
                </h3>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-action border border-green-200">
                  <span class="w-2 h-2 rounded-full bg-action inline-block"></span>
                  <span>{t('admin.system_operational')}</span>
                </span>
              </div>
              <p class="text-sm text-text-sub">
                {t('admin.system_operational')}
              </p>
            </div>

            {/* Quick Navigation Cards */}
            <div>
              <h3 class="text-sm font-bold text-text-main uppercase tracking-wider mb-3">
                {t('admin.quick_nav')}
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Providers Navigation Card */}
                <div class="bg-surface border border-border rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div class="w-10 h-10 rounded-lg bg-blue-50 text-brand flex items-center justify-center mb-3">
                      <ToolIcon size={22} />
                    </div>
                    <h4 class="text-base font-bold text-text-main">
                      {t('admin.providers')}
                    </h4>
                    <p class="text-sm text-text-sub mt-1">
                      {t('admin.manage_providers_desc')}
                    </p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-border/50">
                    <button
                      onClick={() => setAdminTab('providers')}
                      class="min-h-[48px] w-full px-4 py-2 bg-background hover:bg-slate-100 active:bg-slate-200 rounded-lg text-sm font-semibold text-brand flex items-center justify-between border border-border transition-colors"
                    >
                      <span>{t('admin.view_module')}</span>
                      <ChevronRightIcon size={18} />
                    </button>
                  </div>
                </div>

                {/* Bookings Navigation Card */}
                <div class="bg-surface border border-border rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div class="w-10 h-10 rounded-lg bg-amber-50 text-warning flex items-center justify-center mb-3">
                      <FileTextIcon size={22} />
                    </div>
                    <h4 class="text-base font-bold text-text-main">
                      {t('admin.bookings')}
                    </h4>
                    <p class="text-sm text-text-sub mt-1">
                      {t('admin.manage_bookings_desc')}
                    </p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-border/50">
                    <button
                      onClick={() => setAdminTab('bookings')}
                      class="min-h-[48px] w-full px-4 py-2 bg-background hover:bg-slate-100 active:bg-slate-200 rounded-lg text-sm font-semibold text-brand flex items-center justify-between border border-border transition-colors"
                    >
                      <span>{t('admin.view_module')}</span>
                      <ChevronRightIcon size={18} />
                    </button>
                  </div>
                </div>

                {/* Users Navigation Card */}
                <div class="bg-surface border border-border rounded-lg p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div class="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
                      <UsersIcon size={22} />
                    </div>
                    <h4 class="text-base font-bold text-text-main">
                      {t('admin.users')}
                    </h4>
                    <p class="text-sm text-text-sub mt-1">
                      {t('admin.manage_users_desc')}
                    </p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-border/50">
                    <button
                      onClick={() => setAdminTab('users')}
                      class="min-h-[48px] w-full px-4 py-2 bg-background hover:bg-slate-100 active:bg-slate-200 rounded-lg text-sm font-semibold text-brand flex items-center justify-between border border-border transition-colors"
                    >
                      <span>{t('admin.view_module')}</span>
                      <ChevronRightIcon size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Provider Management View */}
        {!loading && activeTab === 'providers' && (
          <AdminProvidersView />
        )}

        {/* Tab 3: Bookings Management View */}
        {!loading && activeTab === 'bookings' && (
          <AdminBookingsView />
        )}

        {/* Tab 4: User Management View */}
        {!loading && activeTab === 'users' && (
          <AdminUsersView />
        )}

        {/* Tab 5: Release Management View */}
        {!loading && activeTab === 'releases' && (
          <AdminReleasesView />
        )}

        {/* Tab 6: Feedback Moderation View */}
        {!loading && activeTab === 'feedback' && (
          <AdminFeedbackView />
        )}
      </main>
    </div>
  );
}
