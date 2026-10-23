import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect } from 'preact/hooks';
import { feedbackList, feedbackTotal, isFeedbackLoading, feedbackError, selectedCategory, selectedStatus, feedbackSearch, feedbackSort, fetchFeedbackList, navigateBeta, } from '../state/beta';
import { t } from '../state/language';
export function BetaFeedbackView() {
    const items = feedbackList.value;
    const total = feedbackTotal.value;
    const loading = isFeedbackLoading.value;
    const error = feedbackError.value;
    const activeCat = selectedCategory.value;
    const activeStat = selectedStatus.value;
    const activeSort = feedbackSort.value;
    const query = feedbackSearch.value;
    useEffect(() => {
        fetchFeedbackList();
    }, [activeCat, activeStat, activeSort]);
    const categories = [
        { id: '', label: t('beta.filter_all') },
        { id: 'BUG_REPORT', label: 'Bug Report' },
        { id: 'UI_DESIGN', label: 'UI / Design' },
        { id: 'PERFORMANCE', label: 'Performance' },
        { id: 'AUTH', label: 'Login / Auth' },
        { id: 'BOOKING', label: 'Booking Flow' },
        { id: 'WORKER_EXPERIENCE', label: 'Worker Experience' },
        { id: 'FEATURE_REQUEST', label: 'Feature Request' },
        { id: 'OTHER', label: 'Other' },
    ];
    const statuses = [
        { id: '', label: 'All Statuses' },
        { id: 'NEW', label: 'New' },
        { id: 'UNDER_REVIEW', label: 'Under Review' },
        { id: 'IN_PROGRESS', label: 'In Progress' },
        { id: 'FIXED', label: 'Fixed' },
        { id: 'WONT_FIX', label: 'Won’t Fix' },
    ];
    const getStatusBadge = (status) => {
        switch (status) {
            case 'FIXED':
                return _jsx("span", { class: "px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800", children: "\u2713 Fixed" });
            case 'IN_PROGRESS':
                return _jsx("span", { class: "px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800", children: "In Progress" });
            case 'UNDER_REVIEW':
                return _jsx("span", { class: "px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800", children: "Under Review" });
            case 'PLANNED':
                return _jsx("span", { class: "px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800", children: "Planned" });
            case 'WONT_FIX':
                return _jsx("span", { class: "px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700", children: "Won\u2019t Fix" });
            case 'NEW':
            default:
                return _jsx("span", { class: "px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700", children: "New" });
        }
    };
    const getCategoryBadge = (cat) => {
        switch (cat) {
            case 'BUG_REPORT':
                return _jsx("span", { class: "px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-danger", children: "Bug" });
            case 'PERFORMANCE':
                return _jsx("span", { class: "px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800", children: "Performance" });
            case 'UI_DESIGN':
                return _jsx("span", { class: "px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800", children: "Design" });
            case 'FEATURE_REQUEST':
                return _jsx("span", { class: "px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800", children: "Feature" });
            default:
                return _jsx("span", { class: "px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700", children: cat.replace(/_/g, ' ') });
        }
    };
    const formatDate = (isoString) => {
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        }
        catch {
            return '';
        }
    };
    return (_jsxs("div", { class: "max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6", children: [_jsxs("div", { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { class: "text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight", children: t('beta.feedback_title') }), _jsx("p", { class: "text-sm text-text-sub mt-1", children: t('beta.feedback_subtitle') })] }), _jsx("button", { onClick: () => navigateBeta('submit-feedback'), class: "min-h-[44px] px-5 py-2.5 bg-brand hover:bg-brand-dark active:bg-slate-900 text-white font-bold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0", children: _jsxs("span", { children: ["+ ", t('beta.submit_feedback_title')] }) })] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-4 shadow-xs space-y-4", children: [_jsxs("div", { class: "flex flex-col sm:flex-row gap-3", children: [_jsxs("div", { class: "relative flex-1", children: [_jsx("input", { type: "text", placeholder: "Search feedback discussions...", value: query, onInput: (e) => {
                                            feedbackSearch.value = e.target.value;
                                        }, onKeyDown: (e) => {
                                            if (e.key === 'Enter')
                                                fetchFeedbackList();
                                        }, class: "w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-brand" }), _jsx("svg", { class: "w-4 h-4 text-slate-400 absolute left-3 top-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-width": "2", d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) })] }), _jsxs("div", { class: "flex gap-2", children: [_jsx("select", { value: activeStat, onChange: (e) => {
                                            selectedStatus.value = e.target.value;
                                        }, class: "px-3 py-2 border border-border rounded-lg text-xs font-semibold bg-white text-text-main focus:outline-none", children: statuses.map((s) => (_jsx("option", { value: s.id, children: s.label }, s.id))) }), _jsxs("select", { value: activeSort, onChange: (e) => {
                                            feedbackSort.value = e.target.value;
                                        }, class: "px-3 py-2 border border-border rounded-lg text-xs font-semibold bg-white text-text-main focus:outline-none", children: [_jsx("option", { value: "newest", children: "Newest First" }), _jsx("option", { value: "most_discussed", children: "Most Discussed" })] })] })] }), _jsx("div", { class: "flex flex-wrap gap-1.5 pt-1 border-t border-border/60", children: categories.map((cat) => (_jsx("button", { onClick: () => {
                                selectedCategory.value = cat.id;
                            }, class: `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${activeCat === cat.id
                                ? 'bg-brand text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-text-sub hover:text-text-main'}`, children: cat.label }, cat.id))) })] }), loading ? (_jsxs("div", { class: "py-16 text-center space-y-3", children: [_jsx("div", { class: "w-8 h-8 mx-auto border-3 border-brand border-t-transparent rounded-full animate-spin" }), _jsx("p", { class: "text-xs text-text-sub", children: "Loading feedback community..." })] })) : error ? (_jsx("div", { class: "p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-danger", children: error })) : items.length === 0 ? (_jsxs("div", { class: "bg-surface border border-border rounded-xl p-12 text-center space-y-4", children: [_jsx("div", { class: "w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-lg", children: "\uD83D\uDCAC" }), _jsx("h3", { class: "text-base font-bold text-text-main", children: "No feedback found" }), _jsx("p", { class: "text-xs text-text-sub max-w-sm mx-auto", children: "Be the first tester to report a bug, suggestion, or comment on the current beta version." }), _jsx("button", { onClick: () => navigateBeta('submit-feedback'), class: "px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark", children: "Submit Feedback \u2192" })] })) : (_jsxs("div", { class: "space-y-3", children: [_jsxs("div", { class: "text-xs text-text-sub font-semibold px-1", children: ["Showing ", items.length, " of ", total, " discussions"] }), _jsx("div", { class: "grid grid-cols-1 gap-3", children: items.map((item) => (_jsxs("div", { onClick: () => navigateBeta('feedback-detail', item.id), class: "bg-surface border border-border hover:border-brand/40 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer space-y-2.5", children: [_jsxs("div", { class: "flex items-center justify-between gap-2", children: [_jsxs("div", { class: "flex items-center gap-2 flex-wrap", children: [item.isPinned && (_jsx("span", { class: "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800", children: "\uD83D\uDCCC PINNED" })), getCategoryBadge(item.category), getStatusBadge(item.status), _jsx("span", { class: "text-[11px] font-mono text-text-sub bg-slate-100 px-1.5 py-0.5 rounded", children: item.appVersion }), _jsxs("span", { class: "text-[11px] text-text-sub capitalize", children: ["(", item.testerRole, ")"] })] }), _jsx("span", { class: "text-xs text-text-sub shrink-0", children: formatDate(item.createdAt) })] }), _jsx("h3", { class: "text-base font-bold text-text-main leading-snug", children: item.title }), _jsx("p", { class: "text-xs text-text-sub line-clamp-2 leading-relaxed", children: item.description }), _jsxs("div", { class: "flex items-center justify-between text-xs text-text-sub pt-1 border-t border-border/40", children: [_jsxs("span", { class: "font-medium text-slate-700", children: ["By ", item.authorName, item.deviceModel && ` &bull; ${item.deviceModel}`] }), _jsx("div", { class: "flex items-center gap-1 font-semibold text-brand", children: _jsxs("span", { children: ["\uD83D\uDCAC ", item.commentsCount, " comments"] }) })] })] }, item.id))) })] }))] }));
}
