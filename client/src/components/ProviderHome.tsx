import { useEffect, useState, useRef } from 'preact/hooks';
import {
  providerJobs,
  isProviderJobsLoading,
  providerJobsError,
  refreshProviderJobs,
  openJobDetail,
  DEFAULT_PROVIDER_POLL_INTERVAL_MS,
  MIN_PROVIDER_POLL_INTERVAL_MS,
  MAX_PROVIDER_POLL_INTERVAL_MS,
  providerPollIntervalMs,
} from '../state/provider';
import { currentUser, logout } from '../state/auth';
import { categories, fetchCategories } from '../state/categories';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES } from '@shared';
import {
  RefreshIcon,
  SpinnerIcon,
  AlertCircleIcon,
  CategoryIconRenderer,
  ChevronRightIcon,
  FileTextIcon,
  MicIcon,
  ClockIcon,
} from './icons';

function formatJobTime(isoString: string, lang: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    return d.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export interface ProviderHomeProps {
  pollIntervalMs?: number;
}

export function ProviderHome({ pollIntervalMs }: ProviderHomeProps = {}) {
  const lang = currentLanguage.value || 'en';
  const user = currentUser.value;
  const jobs = providerJobs.value;
  const isLoading = isProviderJobsLoading.value;
  const error = providerJobsError.value;
  const [filter, setFilter] = useState<'all' | 'assigned' | 'open'>('all');

  const effectivePollInterval = Math.max(
    MIN_PROVIDER_POLL_INTERVAL_MS,
    Math.min(
      MAX_PROVIDER_POLL_INTERVAL_MS,
      pollIntervalMs ?? providerPollIntervalMs.value ?? DEFAULT_PROVIDER_POLL_INTERVAL_MS
    )
  );

  const resetPollingCycleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (categories.value.length === 0) {
      fetchCategories();
    }
    // Initial fetch on mount
    refreshProviderJobs();

    let timer: number | null = null;

    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      timer = window.setInterval(() => {
        // Guard with Page Visibility API: poll only while document is visible
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return;
        }
        refreshProviderJobs({ silent: true });
      }, effectivePollInterval);
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        // Resume immediately when visible and restart polling cycle
        refreshProviderJobs({ silent: true });
        startPolling();
      } else {
        // Pause polling when hidden/backgrounded
        stopPolling();
      }
    };

    resetPollingCycleRef.current = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        startPolling();
      }
    };

    // Start polling if foreground/visible
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      startPolling();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      resetPollingCycleRef.current = null;
      stopPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [effectivePollInterval]);

  const handleManualRefresh = () => {
    refreshProviderJobs();
    resetPollingCycleRef.current?.();
  };

  const assignedJobs = jobs.filter((j) => j.status === 'PROVIDER_ASSIGNED');
  const openJobs = jobs.filter((j) => j.status === 'SERVICE_REQUESTED');
  const filteredJobs = filter === 'assigned'
    ? assignedJobs
    : filter === 'open'
    ? openJobs
    : jobs;

  const providerDisplayName = user?.fullName || user?.phone || '';

  return (
    <div class="min-h-screen flex flex-col bg-background">
      {/* Top Header */}
      <header class="bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 class="text-base font-bold leading-tight">{t('provider.home_title')}</h1>
            <div class="text-[11px] text-slate-300">
              {t('home.service_area_label')}
            </div>
          </div>

          <div class="flex items-center space-x-1">
            <button
              onClick={handleManualRefresh}
              disabled={isLoading}
              class="p-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none transition-colors"
              aria-label={t('provider.refresh')}
              title={t('provider.refresh')}
            >
              <RefreshIcon size={20} class={isLoading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => logout()}
              class="px-2.5 py-1.5 text-xs text-white/90 hover:text-white hover:bg-white/10 rounded-lg min-h-[48px] flex items-center font-medium focus:outline-none transition-colors"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Provider Identity & Context Bar */}
      <div class="bg-surface border-b border-border px-4 py-2.5 shadow-xs">
        <div class="max-w-md mx-auto flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              {t('provider.badge')}
            </span>
            <span class="text-xs font-semibold text-text-main truncate max-w-[180px]">
              {providerDisplayName}
            </span>
            <span id="worker-verified-tick" class="inline-flex items-center text-xs font-bold text-action">
              {t('worker.verified_tick')}
            </span>
          </div>

          {/* Bilingual Toggle */}
          <div class="flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
            <button
              onClick={() => selectLanguage('en')}
              class={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                lang === 'en' ? 'bg-brand text-white shadow-xs' : 'text-text-sub hover:text-text-main'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => selectLanguage('hi')}
              class={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                lang === 'hi' ? 'bg-brand text-white shadow-xs' : 'text-text-sub hover:text-text-main'
              }`}
            >
              हिं
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main class="max-w-md mx-auto w-full p-4 flex-1 space-y-4">
        {/* Section Header */}
        <div class="space-y-2 pt-1">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <h2 class="text-sm font-bold text-text-main">
                {t('provider.available_jobs')}
              </h2>
              <span class="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-action/10 text-action">
                {jobs.length}
              </span>
            </div>

            {isLoading && (
              <div class="flex items-center space-x-1 text-xs text-brand">
                <SpinnerIcon size={14} />
                <span>{t('provider.refreshing')}</span>
              </div>
            )}
          </div>

          {/* Filter Pills when assigned jobs exist */}
          {assignedJobs.length > 0 && (
            <div class="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                class={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors min-h-[36px] ${
                  filter === 'all'
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-surface border border-border text-text-sub hover:text-text-main'
                }`}
              >
                {t('provider.all_jobs')} ({jobs.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('assigned')}
                class={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors min-h-[36px] flex items-center space-x-1.5 ${
                  filter === 'assigned'
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-blue-50 border border-blue-200 text-brand hover:bg-blue-100'
                }`}
              >
                <span>{t('provider.assigned_jobs')}</span>
                <span class={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  filter === 'assigned' ? 'bg-white/20 text-white' : 'bg-blue-200 text-brand'
                }`}>
                  {assignedJobs.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilter('open')}
                class={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors min-h-[36px] ${
                  filter === 'open'
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-surface border border-border text-text-sub hover:text-text-main'
                }`}
              >
                {t('provider.open_jobs')} ({openJobs.length})
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && jobs.length === 0 && (
          <div class="flex flex-col items-center justify-center py-16 space-y-3">
            <SpinnerIcon size={32} class="text-brand" />
            <p class="text-xs text-text-sub font-medium">{t('app.loading')}</p>
          </div>
        )}

        {/* Error State with Retry */}
        {error && (
          <div class="bg-surface border border-red-200 rounded-lg p-6 text-center space-y-4 shadow-sm my-4">
            <div class="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
              <AlertCircleIcon size={28} />
            </div>
            <div>
              <p class="text-sm font-semibold text-text-main">{error}</p>
              <p class="text-xs text-text-sub mt-1">{t('app.network_error')}</p>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              class="min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2"
            >
              <RefreshIcon size={16} />
              <span>{t('app.retry')}</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredJobs.length === 0 && (
          <div class="bg-surface border border-border rounded-lg p-8 text-center space-y-4 shadow-sm my-4">
            <div class="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <ClockIcon size={30} />
            </div>
            <div class="space-y-1">
              <h3 class="text-sm font-bold text-text-main">{t('provider.empty_title')}</h3>
              <p class="text-xs text-text-sub leading-relaxed max-w-xs mx-auto">
                {t('provider.empty_desc')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              class="min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2"
            >
              <RefreshIcon size={16} />
              <span>{t('provider.refresh')}</span>
            </button>
          </div>
        )}

        {/* Job Cards List */}
        {!error && filteredJobs.length > 0 && (
          <div class="space-y-3">
            {filteredJobs.map((job) => {
              const category = categories.value.find((c) => c.id === job.categoryId);
              const categoryTitle = category
                ? (lang === 'hi' ? category.titleHi : category.titleEn)
                : job.categoryId;

              const localityObj = CHANDIL_LOCALITIES.find((l) => l.id === job.areaLocality);
              const localityName = localityObj
                ? (lang === 'hi' ? localityObj.nameHi : localityObj.nameEn)
                : job.areaLocality;

              const shortId = `#CHS-${job.id.substring(0, 8).toUpperCase()}`;
              const isAssigned = job.status === 'PROVIDER_ASSIGNED';

              return (
                <button
                  key={job.id}
                  onClick={() => openJobDetail(job.id)}
                  class={`w-full text-left bg-surface rounded-lg p-4 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand/30 space-y-3 active:bg-slate-50 min-h-[48px] border ${
                    isAssigned
                      ? 'border-blue-300 hover:border-brand bg-blue-50/20'
                      : 'border-border hover:border-brand'
                  }`}
                >
                  {/* Category & Fee Row */}
                  <div class="flex items-start justify-between">
                    <div class="flex items-center space-x-3">
                      <div class={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isAssigned ? 'bg-blue-100 text-brand' : 'bg-brand/10 text-brand'
                      }`}>
                        {category ? (
                          <CategoryIconRenderer iconName={category.iconName} size={22} />
                        ) : (
                          <FileTextIcon size={20} />
                        )}
                      </div>
                      <div>
                        <div class="text-sm font-bold text-text-main leading-tight">
                          {categoryTitle}
                        </div>
                        <div class="flex items-center space-x-2 mt-0.5">
                          <span class="text-xs text-text-sub font-mono">
                            {shortId}
                          </span>
                          {isAssigned ? (
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-brand border border-blue-200">
                              {t('provider.assigned_to_you')}
                            </span>
                          ) : (
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-text-sub border border-slate-200">
                              {t('provider.open_jobs')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div class="text-right">
                      <span class="text-sm font-bold text-action">
                        ₹{job.visitingFee.toFixed(2)}
                      </span>
                      <div class="text-[10px] text-text-sub">
                        {t('booking.cash_on_completion')}
                      </div>
                    </div>
                  </div>

                  {/* Problem Snippet */}
                  {job.textDescription && (
                    <p class="text-xs text-text-main line-clamp-2 bg-slate-50 border border-slate-100 rounded p-2">
                      {job.textDescription}
                    </p>
                  )}

                  {/* Location & Metadata Row */}
                  <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div class="flex items-center space-x-2 text-text-sub truncate mr-2">
                      <span class="font-medium text-text-main">{localityName}</span>
                      {job.landmark && (
                        <>
                          <span>•</span>
                          <span class="truncate">{job.landmark}</span>
                        </>
                      )}
                    </div>

                    <div class="flex items-center space-x-2 shrink-0">
                      {job.audioUrl && (
                        <span class="inline-flex items-center text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                          <MicIcon size={12} class="mr-1" />
                          <span>{job.audioDurationSeconds || 0}s</span>
                        </span>
                      )}
                      <span class="text-text-sub text-[11px]">
                        {formatJobTime(job.createdAt, lang)}
                      </span>
                      <ChevronRightIcon size={16} class="text-slate-400" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
