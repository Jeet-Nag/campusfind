import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useEffect, useState, useRef } from 'preact/hooks';
import { providerJobs, isProviderJobsLoading, providerJobsError, refreshProviderJobs, openJobDetail, DEFAULT_PROVIDER_POLL_INTERVAL_MS, MIN_PROVIDER_POLL_INTERVAL_MS, MAX_PROVIDER_POLL_INTERVAL_MS, providerPollIntervalMs, } from '../state/provider';
import { currentUser, logout } from '../state/auth';
import { categories, fetchCategories } from '../state/categories';
import { currentLanguage, selectLanguage, t } from '../state/language';
import { CHANDIL_LOCALITIES } from '@shared';
import { RefreshIcon, SpinnerIcon, AlertCircleIcon, CategoryIconRenderer, ChevronRightIcon, FileTextIcon, MicIcon, ClockIcon, } from './icons';
function formatJobTime(isoString, lang) {
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime()))
            return isoString;
        const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
        return d.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return isoString;
    }
}
export function ProviderHome({ pollIntervalMs } = {}) {
    const lang = currentLanguage.value || 'en';
    const user = currentUser.value;
    const jobs = providerJobs.value;
    const isLoading = isProviderJobsLoading.value;
    const error = providerJobsError.value;
    const [filter, setFilter] = useState('all');
    const effectivePollInterval = Math.max(MIN_PROVIDER_POLL_INTERVAL_MS, Math.min(MAX_PROVIDER_POLL_INTERVAL_MS, pollIntervalMs ?? providerPollIntervalMs.value ?? DEFAULT_PROVIDER_POLL_INTERVAL_MS));
    const resetPollingCycleRef = useRef(null);
    useEffect(() => {
        if (categories.value.length === 0) {
            fetchCategories();
        }
        // Initial fetch on mount
        refreshProviderJobs();
        let timer = null;
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
            if (typeof document === 'undefined')
                return;
            if (document.visibilityState === 'visible') {
                // Resume immediately when visible and restart polling cycle
                refreshProviderJobs({ silent: true });
                startPolling();
            }
            else {
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
    return (_jsxs("div", { class: "min-h-screen flex flex-col bg-background", children: [_jsx("header", { class: "bg-brand text-white px-4 py-3 sticky top-0 z-10 shadow-sm", children: _jsxs("div", { class: "max-w-md mx-auto flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { class: "text-base font-bold leading-tight", children: t('provider.home_title') }), _jsx("div", { class: "text-[11px] text-slate-300", children: t('home.service_area_label') })] }), _jsxs("div", { class: "flex items-center space-x-1", children: [_jsx("button", { onClick: handleManualRefresh, disabled: isLoading, class: "p-2 text-white hover:bg-white/10 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center focus:outline-none transition-colors", "aria-label": t('provider.refresh'), title: t('provider.refresh'), children: _jsx(RefreshIcon, { size: 20, class: isLoading ? 'animate-spin' : '' }) }), _jsx("button", { onClick: () => logout(), class: "px-2.5 py-1.5 text-xs text-white/90 hover:text-white hover:bg-white/10 rounded-lg min-h-[48px] flex items-center font-medium focus:outline-none transition-colors", children: t('auth.logout') })] })] }) }), _jsx("div", { class: "bg-surface border-b border-border px-4 py-2.5 shadow-xs", children: _jsxs("div", { class: "max-w-md mx-auto flex items-center justify-between", children: [_jsxs("div", { class: "flex items-center space-x-2", children: [_jsx("span", { class: "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200", children: t('provider.badge') }), _jsx("span", { class: "text-xs font-semibold text-text-main truncate max-w-[180px]", children: providerDisplayName }), _jsx("span", { id: "worker-verified-tick", class: "inline-flex items-center text-xs font-bold text-action", children: t('worker.verified_tick') })] }), _jsxs("div", { class: "flex items-center bg-slate-100 rounded p-0.5 border border-slate-200", children: [_jsx("button", { onClick: () => selectLanguage('en'), class: `px-2 py-1 text-[11px] font-bold rounded transition-colors ${lang === 'en' ? 'bg-brand text-white shadow-xs' : 'text-text-sub hover:text-text-main'}`, children: "EN" }), _jsx("button", { onClick: () => selectLanguage('hi'), class: `px-2 py-1 text-[11px] font-bold rounded transition-colors ${lang === 'hi' ? 'bg-brand text-white shadow-xs' : 'text-text-sub hover:text-text-main'}`, children: "\u0939\u093F\u0902" })] })] }) }), _jsxs("main", { class: "max-w-md mx-auto w-full p-4 flex-1 space-y-4", children: [_jsxs("div", { class: "space-y-2 pt-1", children: [_jsxs("div", { class: "flex items-center justify-between", children: [_jsxs("div", { class: "flex items-center space-x-2", children: [_jsx("h2", { class: "text-sm font-bold text-text-main", children: t('provider.available_jobs') }), _jsx("span", { class: "inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-action/10 text-action", children: jobs.length })] }), isLoading && (_jsxs("div", { class: "flex items-center space-x-1 text-xs text-brand", children: [_jsx(SpinnerIcon, { size: 14 }), _jsx("span", { children: t('provider.refreshing') })] }))] }), assignedJobs.length > 0 && (_jsxs("div", { class: "flex items-center space-x-2 pt-1", children: [_jsxs("button", { type: "button", onClick: () => setFilter('all'), class: `px-3 py-1.5 rounded-full text-xs font-bold transition-colors min-h-[36px] ${filter === 'all'
                                            ? 'bg-brand text-white shadow-xs'
                                            : 'bg-surface border border-border text-text-sub hover:text-text-main'}`, children: [t('provider.all_jobs'), " (", jobs.length, ")"] }), _jsxs("button", { type: "button", onClick: () => setFilter('assigned'), class: `px-3 py-1.5 rounded-full text-xs font-bold transition-colors min-h-[36px] flex items-center space-x-1.5 ${filter === 'assigned'
                                            ? 'bg-brand text-white shadow-xs'
                                            : 'bg-blue-50 border border-blue-200 text-brand hover:bg-blue-100'}`, children: [_jsx("span", { children: t('provider.assigned_jobs') }), _jsx("span", { class: `px-1.5 py-0.2 rounded-full text-[10px] font-bold ${filter === 'assigned' ? 'bg-white/20 text-white' : 'bg-blue-200 text-brand'}`, children: assignedJobs.length })] }), _jsxs("button", { type: "button", onClick: () => setFilter('open'), class: `px-3 py-1.5 rounded-full text-xs font-bold transition-colors min-h-[36px] ${filter === 'open'
                                            ? 'bg-brand text-white shadow-xs'
                                            : 'bg-surface border border-border text-text-sub hover:text-text-main'}`, children: [t('provider.open_jobs'), " (", openJobs.length, ")"] })] }))] }), isLoading && jobs.length === 0 && (_jsxs("div", { class: "flex flex-col items-center justify-center py-16 space-y-3", children: [_jsx(SpinnerIcon, { size: 32, class: "text-brand" }), _jsx("p", { class: "text-xs text-text-sub font-medium", children: t('app.loading') })] })), error && (_jsxs("div", { class: "bg-surface border border-red-200 rounded-lg p-6 text-center space-y-4 shadow-sm my-4", children: [_jsx("div", { class: "w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto", children: _jsx(AlertCircleIcon, { size: 28 }) }), _jsxs("div", { children: [_jsx("p", { class: "text-sm font-semibold text-text-main", children: error }), _jsx("p", { class: "text-xs text-text-sub mt-1", children: t('app.network_error') })] }), _jsxs("button", { type: "button", onClick: handleManualRefresh, class: "min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2", children: [_jsx(RefreshIcon, { size: 16 }), _jsx("span", { children: t('app.retry') })] })] })), !isLoading && !error && filteredJobs.length === 0 && (_jsxs("div", { class: "bg-surface border border-border rounded-lg p-8 text-center space-y-4 shadow-sm my-4", children: [_jsx("div", { class: "w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto", children: _jsx(ClockIcon, { size: 30 }) }), _jsxs("div", { class: "space-y-1", children: [_jsx("h3", { class: "text-sm font-bold text-text-main", children: t('provider.empty_title') }), _jsx("p", { class: "text-xs text-text-sub leading-relaxed max-w-xs mx-auto", children: t('provider.empty_desc') })] }), _jsxs("button", { type: "button", onClick: handleManualRefresh, class: "min-h-[48px] px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center space-x-2", children: [_jsx(RefreshIcon, { size: 16 }), _jsx("span", { children: t('provider.refresh') })] })] })), !error && filteredJobs.length > 0 && (_jsx("div", { class: "space-y-3", children: filteredJobs.map((job) => {
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
                            return (_jsxs("button", { onClick: () => openJobDetail(job.id), class: `w-full text-left bg-surface rounded-lg p-4 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand/30 space-y-3 active:bg-slate-50 min-h-[48px] border ${isAssigned
                                    ? 'border-blue-300 hover:border-brand bg-blue-50/20'
                                    : 'border-border hover:border-brand'}`, children: [_jsxs("div", { class: "flex items-start justify-between", children: [_jsxs("div", { class: "flex items-center space-x-3", children: [_jsx("div", { class: `w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isAssigned ? 'bg-blue-100 text-brand' : 'bg-brand/10 text-brand'}`, children: category ? (_jsx(CategoryIconRenderer, { iconName: category.iconName, size: 22 })) : (_jsx(FileTextIcon, { size: 20 })) }), _jsxs("div", { children: [_jsx("div", { class: "text-sm font-bold text-text-main leading-tight", children: categoryTitle }), _jsxs("div", { class: "flex items-center space-x-2 mt-0.5", children: [_jsx("span", { class: "text-xs text-text-sub font-mono", children: shortId }), isAssigned ? (_jsx("span", { class: "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-brand border border-blue-200", children: t('provider.assigned_to_you') })) : (_jsx("span", { class: "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-text-sub border border-slate-200", children: t('provider.open_jobs') }))] })] })] }), _jsxs("div", { class: "text-right", children: [_jsxs("span", { class: "text-sm font-bold text-action", children: ["\u20B9", job.visitingFee.toFixed(2)] }), _jsx("div", { class: "text-[10px] text-text-sub", children: t('booking.cash_on_completion') })] })] }), job.textDescription && (_jsx("p", { class: "text-xs text-text-main line-clamp-2 bg-slate-50 border border-slate-100 rounded p-2", children: job.textDescription })), _jsxs("div", { class: "flex items-center justify-between text-xs pt-1 border-t border-slate-100", children: [_jsxs("div", { class: "flex items-center space-x-2 text-text-sub truncate mr-2", children: [_jsx("span", { class: "font-medium text-text-main", children: localityName }), job.landmark && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2022" }), _jsx("span", { class: "truncate", children: job.landmark })] }))] }), _jsxs("div", { class: "flex items-center space-x-2 shrink-0", children: [job.audioUrl && (_jsxs("span", { class: "inline-flex items-center text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold", children: [_jsx(MicIcon, { size: 12, class: "mr-1" }), _jsxs("span", { children: [job.audioDurationSeconds || 0, "s"] })] })), _jsx("span", { class: "text-text-sub text-[11px]", children: formatJobTime(job.createdAt, lang) }), _jsx(ChevronRightIcon, { size: 16, class: "text-slate-400" })] })] })] }, job.id));
                        }) }))] })] }));
}
