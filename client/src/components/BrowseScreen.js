import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect } from 'preact/hooks';
import { campusItems, itemsLoading, itemsError, filterType, filterCategory, filterLocation, filterStatus, searchQuery, fetchCampusItems, navigateTo, } from '../state/campus';
import { CAMPUS_CATEGORIES, CAMPUS_LOCATIONS } from '@shared';
export function BrowseScreen() {
    useEffect(() => {
        fetchCampusItems();
    }, [
        filterType.value,
        filterCategory.value,
        filterLocation.value,
        filterStatus.value,
        searchQuery.value,
    ]);
    const resetFilters = () => {
        filterType.value = 'all';
        filterCategory.value = 'all';
        filterLocation.value = 'all';
        filterStatus.value = 'all';
        searchQuery.value = '';
        fetchCampusItems();
    };
    const hasActiveFilters = filterType.value !== 'all' ||
        filterCategory.value !== 'all' ||
        filterLocation.value !== 'all' ||
        filterStatus.value !== 'all' ||
        searchQuery.value.trim().length > 0;
    return (_jsxs("div", { class: "space-y-6 pb-12", children: [_jsxs("div", { class: "flex flex-col md:flex-row md:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { class: "text-2xl font-extrabold text-brand tracking-tight", children: "Browse Campus Items" }), _jsx("p", { class: "text-xs sm:text-sm text-text-sub mt-0.5", children: "Search lost items reported by students or items turned into campus desks" })] }), _jsxs("div", { class: "flex items-center gap-2", children: [_jsx("button", { onClick: () => navigateTo('report-lost'), class: "px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-xs", children: "+ Report Lost" }), _jsx("button", { onClick: () => navigateTo('report-found'), class: "px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs", children: "+ Report Found" })] })] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-4 shadow-xs space-y-4", children: [_jsxs("div", { class: "flex items-center p-1 bg-slate-100 rounded-lg max-w-sm", children: [_jsx("button", { onClick: () => {
                                    filterType.value = 'all';
                                }, class: `flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filterType.value === 'all'
                                    ? 'bg-white text-text-main shadow-xs'
                                    : 'text-text-sub hover:text-text-main'}`, children: "All Items" }), _jsx("button", { onClick: () => {
                                    filterType.value = 'lost';
                                }, class: `flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filterType.value === 'lost'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-text-sub hover:text-amber-800'}`, children: "\uD83D\uDCE2 Lost Items" }), _jsx("button", { onClick: () => {
                                    filterType.value = 'found';
                                }, class: `flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filterType.value === 'found'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-text-sub hover:text-emerald-800'}`, children: "\uD83C\uDF81 Found Items" })] }), _jsxs("div", { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3", children: [_jsxs("div", { class: "relative", children: [_jsx("span", { class: "absolute left-3 top-1/2 -translate-y-1/2 text-text-sub text-xs", children: "\uD83D\uDD0D" }), _jsx("input", { type: "text", value: searchQuery.value, onInput: (e) => {
                                            searchQuery.value = e.target.value;
                                        }, placeholder: "Search title, keywords...", class: "w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main" }), searchQuery.value && (_jsx("button", { onClick: () => {
                                            searchQuery.value = '';
                                        }, class: "absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-sub hover:text-text-main", children: "\u2715" }))] }), _jsx("div", { children: _jsxs("select", { value: filterCategory.value, onChange: (e) => {
                                        filterCategory.value = e.target.value;
                                    }, class: "w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main cursor-pointer", children: [_jsx("option", { value: "all", children: "All Categories" }), CAMPUS_CATEGORIES.map((cat) => (_jsxs("option", { value: cat.id, children: [cat.icon, " ", cat.label] }, cat.id)))] }) }), _jsx("div", { children: _jsxs("select", { value: filterLocation.value, onChange: (e) => {
                                        filterLocation.value = e.target.value;
                                    }, class: "w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main cursor-pointer", children: [_jsx("option", { value: "all", children: "All Campus Locations" }), CAMPUS_LOCATIONS.map((loc) => (_jsxs("option", { value: loc, children: ["\uD83D\uDCCD ", loc] }, loc)))] }) }), _jsx("div", { children: _jsxs("select", { value: filterStatus.value, onChange: (e) => {
                                        filterStatus.value = e.target.value;
                                    }, class: "w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main cursor-pointer", children: [_jsx("option", { value: "all", children: "All Statuses" }), _jsx("option", { value: "open", children: "\uD83D\uDFE2 Open (Active)" }), _jsx("option", { value: "claim_pending", children: "\uD83D\uDFE1 Claim Pending" }), _jsx("option", { value: "returned", children: "\uD83D\uDD35 Returned / Resolved" })] }) })] }), _jsxs("div", { class: "flex items-center justify-between text-xs text-text-sub pt-1", children: [_jsxs("span", { children: ["Found ", _jsx("strong", { children: campusItems.value.length }), " ", campusItems.value.length === 1 ? 'item' : 'items'] }), hasActiveFilters && (_jsxs("button", { onClick: resetFilters, class: "text-brand font-semibold hover:underline flex items-center gap-1", children: [_jsx("span", { children: "\u21BA" }), " Reset All Filters"] }))] })] }), itemsLoading.value ? (
            /* Loading Skeleton */
            _jsx("div", { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: [1, 2, 3, 4, 5, 6].map((n) => (_jsxs("div", { class: "bg-surface border border-border rounded-xl p-4 space-y-3 animate-pulse", children: [_jsx("div", { class: "h-36 bg-slate-200 rounded-lg" }), _jsx("div", { class: "h-4 bg-slate-200 rounded w-3/4" }), _jsx("div", { class: "h-3 bg-slate-100 rounded w-full" }), _jsx("div", { class: "h-3 bg-slate-100 rounded w-1/2" })] }, n))) })) : itemsError.value ? (
            /* Error State */
            _jsxs("div", { class: "bg-rose-50 border border-rose-200 rounded-xl p-8 text-center max-w-lg mx-auto", children: [_jsx("div", { class: "text-3xl mb-2", children: "\u26A0\uFE0F" }), _jsx("h3", { class: "text-base font-bold text-rose-900", children: "Unable to load items" }), _jsx("p", { class: "text-xs text-rose-700 mt-1", children: itemsError.value }), _jsx("button", { onClick: () => fetchCampusItems(), class: "mt-4 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors", children: "Retry Loading" })] })) : campusItems.value.length === 0 ? (
            /* Empty State */
            _jsxs("div", { class: "bg-surface border border-border rounded-xl p-12 text-center max-w-md mx-auto space-y-3", children: [_jsx("div", { class: "text-4xl", children: "\uD83D\uDD0D" }), _jsx("h3", { class: "text-base font-bold text-text-main", children: "No Items Found" }), _jsx("p", { class: "text-xs text-text-sub", children: "We couldn't find any items matching your current search criteria." }), _jsxs("div", { class: "pt-2 flex flex-col sm:flex-row items-center justify-center gap-2", children: [hasActiveFilters && (_jsx("button", { onClick: resetFilters, class: "px-4 py-2 text-xs font-bold border border-border rounded-lg text-text-sub hover:bg-slate-100 transition-colors", children: "Clear Filters" })), _jsx("button", { onClick: () => navigateTo('report-lost'), class: "px-4 py-2 text-xs font-bold bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors", children: "Post a Report" })] })] })) : (
            /* Items Grid */
            _jsx("div", { class: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5", children: campusItems.value.map((item) => {
                    const isLost = item.type === 'lost';
                    const catInfo = CAMPUS_CATEGORIES.find((c) => c.id === item.category);
                    return (_jsxs("div", { onClick: () => navigateTo('item-detail', item.id), class: "bg-surface border border-border hover:border-brand/70 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group", children: [_jsxs("div", { children: [_jsxs("div", { class: "h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center", children: [item.imageUrl ? (_jsx("img", { src: item.imageUrl, alt: item.title, class: "w-full h-full object-cover group-hover:scale-103 transition-transform duration-300", loading: "lazy" })) : (_jsx("div", { class: "flex flex-col items-center justify-center text-slate-400", children: _jsx("span", { class: "text-5xl", children: catInfo?.icon || '📦' }) })), _jsx("div", { class: "absolute top-2.5 left-2.5", children: _jsx("span", { class: `text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-xs ${isLost ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`, children: isLost ? '📢 Lost' : '🎁 Found' }) }), _jsx("div", { class: "absolute top-2.5 right-2.5", children: _jsx("span", { class: `text-[10px] font-bold px-2 py-0.5 rounded shadow-xs backdrop-blur-md ${item.status === 'returned'
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                        : item.status === 'claim_pending'
                                                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                            : 'bg-white/95 text-text-sub border border-border'}`, children: item.status === 'returned'
                                                        ? '✓ Returned'
                                                        : item.status === 'claim_pending'
                                                            ? '⏳ Claim Pending'
                                                            : '● Open' }) }), item.isSensitive && (_jsx("div", { class: "absolute bottom-2 left-2", children: _jsx("span", { class: "text-[10px] font-bold bg-slate-900/80 text-white px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1", children: "\uD83D\uDD12 ID / Sensitive Item" }) }))] }), _jsxs("div", { class: "p-4 space-y-2", children: [_jsxs("div", { class: "flex items-center gap-1.5 text-[11px] font-semibold text-text-sub", children: [_jsx("span", { children: catInfo?.icon }), _jsx("span", { children: catInfo?.label || item.category })] }), _jsx("h3", { class: "text-sm font-bold text-text-main line-clamp-1 group-hover:text-brand transition-colors", children: item.title }), _jsx("p", { class: "text-xs text-text-sub line-clamp-2 leading-relaxed", children: item.description })] })] }), _jsxs("div", { class: "p-4 pt-2 border-t border-border/50 bg-slate-50/50 flex items-center justify-between text-[11px] text-text-sub", children: [_jsxs("span", { class: "truncate max-w-[150px] font-medium text-text-main", children: ["\uD83D\uDCCD ", item.location] }), _jsxs("span", { children: ["\uD83D\uDCC5 ", item.dateOccurred] })] })] }, item.id));
                }) }))] }));
}
