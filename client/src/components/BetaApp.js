import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect } from 'preact/hooks';
import { currentBetaPage, latestRelease, fetchLatestRelease, fetchReleasesList, navigateBeta, } from '../state/beta';
import { BetaHeader } from './BetaHeader';
import { BetaHero } from './BetaHero';
import { BetaDownloadView } from './BetaDownloadView';
import { BetaFeedbackView } from './BetaFeedbackView';
import { BetaSubmitFeedbackModal } from './BetaSubmitFeedbackModal';
import { BetaFeedbackDetailView } from './BetaFeedbackDetailView';
import { BetaFooter } from './BetaFooter';
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
            }
            else if (path === '/feedback' || path.startsWith('/feedback/')) {
                navigateBeta('feedback');
            }
        }
    }, []);
    return (_jsxs("div", { class: "min-h-screen flex flex-col bg-background text-text-main antialiased selection:bg-brand selection:text-white", children: [_jsx(BetaHeader, {}), _jsxs("main", { class: "flex-1", children: [page === 'home' && (_jsxs("div", { children: [_jsx(BetaHero, {}), _jsxs("section", { class: "max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-12", children: [_jsxs("div", { class: "text-center max-w-2xl mx-auto space-y-2", children: [_jsx("span", { class: "text-xs font-bold uppercase tracking-wider text-brand", children: "Engineered for Jharkhand" }), _jsx("h2", { class: "text-2xl sm:text-3xl font-black text-text-main tracking-tight", children: "Why We Are Building a Dedicated Hyperlocal App" }), _jsx("p", { class: "text-xs sm:text-sm text-text-sub leading-relaxed", children: "Rural and semi-urban households in Chandil struggle to find vetted electricians, plumbers, and mechanics with transparent pricing." })] }), _jsxs("div", { class: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { class: "bg-surface border border-border rounded-xl p-6 shadow-xs space-y-3", children: [_jsx("div", { class: "w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg", children: "\u26A1" }), _jsx("h3", { class: "text-base font-bold text-text-main", children: "Works on 2G/3G & Low-End Phones" }), _jsx("p", { class: "text-xs text-text-sub leading-relaxed", children: "Designed to consume minimal mobile data and operate smoothly on \u20B96,000\u2013\u20B910,000 Android phones common in Jharkhand." })] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-6 shadow-xs space-y-3", children: [_jsx("div", { class: "w-10 h-10 rounded-lg bg-blue-100 text-brand flex items-center justify-center font-bold text-lg", children: "\uD83C\uDF99\uFE0F" }), _jsx("h3", { class: "text-base font-bold text-text-main", children: "Audio Voice Bookings & Hindi" }), _jsx("p", { class: "text-xs text-text-sub leading-relaxed", children: "Customers who find typing difficult can record a quick 20-second voice note describing the repair issue in Hindi or English." })] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-6 shadow-xs space-y-3", children: [_jsx("div", { class: "w-10 h-10 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-lg", children: "\uD83D\uDEE1\uFE0F" }), _jsx("h3", { class: "text-base font-bold text-text-main", children: "Aadhaar-Verified Local Technicians" }), _jsx("p", { class: "text-xs text-text-sub leading-relaxed", children: "Every service provider is verified by local operations in Chandil with ID checks, physical background verification, and fixed visiting rates." })] })] }), _jsxs("div", { class: "bg-gradient-to-r from-slate-900 to-brand-dark rounded-2xl p-6 sm:p-10 text-white space-y-6", children: [_jsxs("div", { class: "max-w-xl space-y-2", children: [_jsx("span", { class: "text-emerald-400 text-xs font-bold uppercase tracking-wider", children: "Beta Feedback Community" }), _jsx("h3", { class: "text-2xl font-bold", children: "Help Us Find Bugs Before Launch" }), _jsx("p", { class: "text-slate-300 text-xs sm:text-sm leading-relaxed", children: "Whether you are testing booking requests, the worker job feed, or screen performance on your phone, your reports directly guide development." })] }), _jsxs("div", { class: "flex flex-wrap gap-3", children: [_jsx("button", { onClick: () => navigateBeta('download'), class: "px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm", children: "Download Latest APK \u2192" }), _jsx("button", { onClick: () => navigateBeta('submit-feedback'), class: "px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg border border-white/20", children: "Report an Issue" })] })] })] })] })), page === 'download' && _jsx(BetaDownloadView, {}), page === 'feedback' && _jsx(BetaFeedbackView, {}), page === 'submit-feedback' && _jsx(BetaSubmitFeedbackModal, {}), page === 'feedback-detail' && _jsx(BetaFeedbackDetailView, {})] }), _jsx(BetaFooter, {})] }));
}
