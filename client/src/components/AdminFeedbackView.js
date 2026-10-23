import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useState, useEffect } from 'preact/hooks';
import { authToken } from '../state/auth';
import { getApiUrl } from '../config/api';
export function AdminFeedbackView() {
    const [items, setItems] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Filters
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [reportedOnly, setReportedOnly] = useState(false);
    // Moderation detail modal
    const [selectedItem, setSelectedItem] = useState(null);
    const [comments, setComments] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [adminReply, setAdminReply] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);
    const [replyError, setReplyError] = useState(null);
    const [actionSuccess, setActionSuccess] = useState(null);
    const [zoomImage, setZoomImage] = useState(null);
    const token = authToken.value;
    const loadFeedback = async () => {
        if (!token)
            return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (selectedStatus !== 'ALL')
                params.set('status', selectedStatus);
            if (selectedCategory !== 'ALL')
                params.set('category', selectedCategory);
            if (searchQuery.trim())
                params.set('search', searchQuery.trim());
            params.set('limit', '50');
            const res = await fetch(getApiUrl(`/api/admin/beta/feedback?${params.toString()}`), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.data) {
                let result = data.data.items;
                if (reportedOnly) {
                    result = result.filter((i) => i.isReported);
                }
                setItems(result);
                setTotalCount(data.data.total);
            }
            else {
                setError(data.error?.messageEn || 'Failed to load feedback.');
            }
        }
        catch (err) {
            setError(err.message || 'Network error loading feedback.');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadFeedback();
    }, [token, selectedStatus, selectedCategory, reportedOnly]);
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadFeedback();
    };
    // Open moderation modal
    const openDetail = async (item) => {
        setSelectedItem(item);
        setLoadingDetail(true);
        setAdminReply('');
        setReplyError(null);
        setActionSuccess(null);
        try {
            const res = await fetch(getApiUrl(`/api/admin/beta/feedback/${item.id}`), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.data) {
                setSelectedItem(data.data.feedback);
                setComments(data.data.comments || []);
            }
        }
        catch {
            // Fallback to comments loaded if any
        }
        finally {
            setLoadingDetail(false);
        }
    };
    // Quick Status change
    const handleStatusChange = async (feedbackId, newStatus) => {
        try {
            const res = await fetch(getApiUrl(`/api/admin/beta/feedback/${feedbackId}/status`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                setItems((prev) => prev.map((item) => (item.id === feedbackId ? { ...item, status: newStatus } : item)));
                if (selectedItem && selectedItem.id === feedbackId) {
                    setSelectedItem({ ...selectedItem, status: newStatus });
                }
                setActionSuccess(`Status updated to ${newStatus}`);
                setTimeout(() => setActionSuccess(null), 3000);
            }
        }
        catch (err) {
            setError(err.message || 'Failed to update status.');
        }
    };
    // Toggle Pin
    const handleTogglePin = async (feedbackId, currentPin) => {
        try {
            const res = await fetch(getApiUrl(`/api/admin/beta/feedback/${feedbackId}/pin`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ isPinned: !currentPin }),
            });
            const data = await res.json();
            if (data.success) {
                setItems((prev) => prev.map((item) => (item.id === feedbackId ? { ...item, isPinned: !currentPin } : item)));
                if (selectedItem && selectedItem.id === feedbackId) {
                    setSelectedItem({ ...selectedItem, isPinned: !currentPin });
                }
                setActionSuccess(!currentPin ? 'Discussion pinned to top.' : 'Discussion unpinned.');
                setTimeout(() => setActionSuccess(null), 3000);
            }
        }
        catch (err) {
            setError(err.message || 'Failed to toggle pin.');
        }
    };
    // Moderate comment
    const handleModerateComment = async (commentId, newStatus) => {
        try {
            const res = await fetch(getApiUrl(`/api/admin/beta/feedback/comments/${commentId}/moderate`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ moderationStatus: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, moderationStatus: newStatus } : c)));
                setActionSuccess(`Comment ${newStatus === 'APPROVED' ? 'approved' : 'flagged'}.`);
                setTimeout(() => setActionSuccess(null), 3000);
            }
        }
        catch (err) {
            setReplyError(err.message || 'Failed to moderate comment.');
        }
    };
    // Submit admin reply
    const handleAdminReplySubmit = async (e) => {
        e.preventDefault();
        if (!selectedItem)
            return;
        if (!adminReply.trim()) {
            setReplyError('Please enter a response message.');
            return;
        }
        setSubmittingReply(true);
        setReplyError(null);
        try {
            const res = await fetch(getApiUrl(`/api/admin/beta/feedback/${selectedItem.id}/comments`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: adminReply.trim(),
                    authorName: 'Chandil Team (Official Response)',
                }),
            });
            const data = await res.json();
            if (data.success && data.data?.comment) {
                setComments((prev) => [...prev, data.data.comment]);
                setAdminReply('');
                setActionSuccess('Admin reply published.');
                setTimeout(() => setActionSuccess(null), 3000);
            }
            else {
                setReplyError(data.error?.messageEn || 'Failed to post reply.');
            }
        }
        catch (err) {
            setReplyError(err.message || 'Error posting reply.');
        }
        finally {
            setSubmittingReply(false);
        }
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case 'NEW':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'UNDER_REVIEW':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'PLANNED':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'IN_PROGRESS':
                return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'FIXED':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'WONT_FIX':
                return 'bg-slate-100 text-slate-600 border-slate-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };
    const getCategoryBadge = (category) => {
        switch (category) {
            case 'BUG_REPORT':
                return 'bg-red-50 text-red-700 border-red-200';
            case 'PERFORMANCE':
                return 'bg-orange-50 text-orange-700 border-orange-200';
            case 'AUTH':
                return 'bg-yellow-50 text-yellow-800 border-yellow-200';
            case 'BOOKING':
                return 'bg-teal-50 text-teal-700 border-teal-200';
            case 'WORKER_EXPERIENCE':
                return 'bg-emerald-50 text-emerald-800 border-emerald-200';
            case 'UI_DESIGN':
                return 'bg-sky-50 text-sky-700 border-sky-200';
            case 'FEATURE_REQUEST':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };
    const reportedCount = items.filter((i) => i.isReported).length;
    return (_jsxs("div", { class: "space-y-6", children: [_jsxs("div", { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border", children: [_jsxs("div", { children: [_jsx("h2", { class: "text-xl font-bold text-text-main", children: "Tester Feedback & Moderation" }), _jsx("p", { class: "text-xs text-text-sub mt-0.5", children: "Review bug reports, user suggestions, and moderate community discussion threads." })] }), _jsx("div", { class: "flex items-center gap-2", children: _jsx("button", { onClick: () => loadFeedback(), disabled: loading, class: "px-3 py-1.5 bg-surface border border-border hover:bg-background rounded-lg text-xs font-semibold text-text-main transition-colors flex items-center gap-1.5", children: "Refresh" }) })] }), actionSuccess && (_jsx("div", { class: "p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium", children: actionSuccess })), error && (_jsx("div", { class: "p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium", children: error })), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-4 shadow-xs space-y-3", children: [_jsxs("form", { onSubmit: handleSearchSubmit, class: "flex flex-col sm:flex-row gap-3", children: [_jsx("div", { class: "flex-1 relative", children: _jsx("input", { type: "text", value: searchQuery, onInput: (e) => setSearchQuery(e.target.value), placeholder: "Search feedback titles, descriptions, or tester names...", class: "w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-text-main placeholder-text-sub focus:outline-none focus:ring-1 focus:ring-brand" }) }), _jsx("button", { type: "submit", class: "px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors", children: "Search" })] }), _jsxs("div", { class: "flex flex-wrap items-center gap-3 pt-2 border-t border-border/60", children: [_jsxs("div", { class: "flex items-center gap-1.5 text-xs", children: [_jsx("span", { class: "text-text-sub font-medium", children: "Status:" }), _jsxs("select", { value: selectedStatus, onChange: (e) => setSelectedStatus(e.target.value), class: "px-2 py-1 text-xs bg-background border border-border rounded-md text-text-main", children: [_jsx("option", { value: "ALL", children: "All Statuses" }), _jsx("option", { value: "NEW", children: "New" }), _jsx("option", { value: "UNDER_REVIEW", children: "Under Review" }), _jsx("option", { value: "PLANNED", children: "Planned" }), _jsx("option", { value: "IN_PROGRESS", children: "In Progress" }), _jsx("option", { value: "FIXED", children: "Fixed" }), _jsx("option", { value: "WONT_FIX", children: "Won't Fix" })] })] }), _jsxs("div", { class: "flex items-center gap-1.5 text-xs", children: [_jsx("span", { class: "text-text-sub font-medium", children: "Category:" }), _jsxs("select", { value: selectedCategory, onChange: (e) => setSelectedCategory(e.target.value), class: "px-2 py-1 text-xs bg-background border border-border rounded-md text-text-main", children: [_jsx("option", { value: "ALL", children: "All Categories" }), _jsx("option", { value: "BUG_REPORT", children: "Bug Report" }), _jsx("option", { value: "PERFORMANCE", children: "Performance" }), _jsx("option", { value: "AUTH", children: "Authentication / Login" }), _jsx("option", { value: "BOOKING", children: "Booking Flow" }), _jsx("option", { value: "WORKER_EXPERIENCE", children: "Worker Experience" }), _jsx("option", { value: "UI_DESIGN", children: "UI / Design" }), _jsx("option", { value: "FEATURE_REQUEST", children: "Feature Request" }), _jsx("option", { value: "OTHER", children: "Other" })] })] }), _jsxs("label", { class: "flex items-center gap-1.5 text-xs text-text-main cursor-pointer ml-auto", children: [_jsx("input", { type: "checkbox", checked: reportedOnly, onChange: (e) => setReportedOnly(e.target.checked), class: "rounded border-border text-red-600 focus:ring-red-500" }), _jsxs("span", { class: reportedCount > 0 ? 'text-red-700 font-semibold' : 'text-text-sub', children: ["Reported Only (", reportedCount, ")"] })] })] })] }), loading ? (_jsx("div", { class: "py-12 text-center text-xs text-text-sub", children: "Loading feedback items..." })) : items.length === 0 ? (_jsxs("div", { class: "bg-surface border border-border rounded-xl p-8 text-center space-y-2", children: [_jsx("p", { class: "text-sm font-semibold text-text-main", children: "No feedback items found" }), _jsx("p", { class: "text-xs text-text-sub", children: "Try modifying your search or filter options." })] })) : (_jsx("div", { class: "space-y-3", children: items.map((item) => (_jsx("div", { class: `bg-surface border rounded-xl p-4 shadow-xs hover:border-slate-300 transition-all ${item.isReported ? 'border-red-300 bg-red-50/20' : 'border-border'}`, children: _jsxs("div", { class: "flex flex-col md:flex-row md:items-center justify-between gap-3", children: [_jsxs("div", { class: "flex-1 space-y-1.5", children: [_jsxs("div", { class: "flex flex-wrap items-center gap-2", children: [item.isPinned && (_jsx("span", { class: "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300", children: "PINNED" })), item.isReported && (_jsxs("span", { class: "px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300", children: ["REPORTED (", item.reportCount, ")"] })), _jsx("span", { class: `px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadge(item.category)}`, children: item.category.replace('_', ' ') }), _jsx("span", { class: `px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(item.status)}`, children: item.status.replace('_', ' ') }), _jsxs("span", { class: "text-[11px] text-text-sub font-mono", children: ["App ", item.appVersion] })] }), _jsx("h3", { onClick: () => openDetail(item), class: "text-sm font-bold text-text-main hover:text-brand cursor-pointer", children: item.title }), _jsx("p", { class: "text-xs text-text-sub line-clamp-2", children: item.description }), _jsxs("div", { class: "flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-sub pt-1", children: [_jsxs("span", { children: ["By: ", _jsx("strong", { class: "text-text-main", children: item.authorName }), " (", item.testerRole, ")"] }), item.deviceModel && _jsxs("span", { children: ["Device: ", item.deviceModel] }), item.androidVersion && _jsxs("span", { children: ["Android: ", item.androidVersion] }), _jsxs("span", { children: ["Comments: ", item.commentsCount] }), _jsxs("span", { children: ["Date: ", new Date(item.createdAt).toLocaleDateString('en-IN')] })] })] }), _jsxs("div", { class: "flex flex-wrap md:flex-col items-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/60", children: [_jsxs("div", { class: "flex items-center gap-1.5", children: [_jsxs("select", { value: item.status, onChange: (e) => handleStatusChange(item.id, e.target.value), class: "px-2 py-1 text-xs bg-background border border-border rounded text-text-main font-medium", children: [_jsx("option", { value: "NEW", children: "New" }), _jsx("option", { value: "UNDER_REVIEW", children: "Under Review" }), _jsx("option", { value: "PLANNED", children: "Planned" }), _jsx("option", { value: "IN_PROGRESS", children: "In Progress" }), _jsx("option", { value: "FIXED", children: "Fixed" }), _jsx("option", { value: "WONT_FIX", children: "Won't Fix" })] }), _jsx("button", { onClick: () => handleTogglePin(item.id, item.isPinned), title: item.isPinned ? 'Unpin' : 'Pin to top', class: `px-2.5 py-1 text-xs rounded border font-medium ${item.isPinned
                                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                    : 'bg-background text-text-sub border-border hover:text-text-main'}`, children: item.isPinned ? 'Pinned' : 'Pin' })] }), _jsx("button", { onClick: () => openDetail(item), class: "px-3 py-1 bg-brand text-white text-xs font-semibold rounded hover:bg-brand-dark transition-colors", children: "View & Moderate \u2192" })] })] }) }, item.id))) })), selectedItem && (_jsx("div", { class: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto", children: _jsxs("div", { class: "bg-surface border border-border rounded-2xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]", children: [_jsxs("div", { class: "px-6 py-4 bg-slate-900 text-white flex items-center justify-between", children: [_jsxs("div", { class: "flex items-center gap-2", children: [_jsx("span", { class: `px-2 py-0.5 rounded text-[10px] font-semibold border ${getCategoryBadge(selectedItem.category)}`, children: selectedItem.category.replace('_', ' ') }), _jsx("h3", { class: "text-sm font-bold truncate max-w-md", children: selectedItem.title })] }), _jsx("button", { onClick: () => setSelectedItem(null), class: "w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm", children: "\u00D7" })] }), _jsxs("div", { class: "p-6 overflow-y-auto space-y-6 flex-1 text-xs text-text-main", children: [_jsxs("div", { class: "bg-background border border-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]", children: [_jsxs("div", { children: [_jsx("span", { class: "text-text-sub block", children: "Submitted By" }), _jsx("span", { class: "font-bold text-text-main", children: selectedItem.authorName })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block", children: "Tester Role" }), _jsx("span", { class: "font-semibold text-text-main", children: selectedItem.testerRole })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block", children: "App Version" }), _jsx("span", { class: "font-mono text-text-main", children: selectedItem.appVersion })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub block", children: "Device / OS" }), _jsxs("span", { class: "text-text-main", children: [selectedItem.deviceModel || 'N/A', " ", selectedItem.androidVersion ? `(Android ${selectedItem.androidVersion})` : ''] })] })] }), _jsxs("div", { class: "flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-border rounded-xl", children: [_jsxs("div", { class: "flex items-center gap-2", children: [_jsx("span", { class: "font-bold text-text-main", children: "Resolution Status:" }), _jsxs("select", { value: selectedItem.status, onChange: (e) => handleStatusChange(selectedItem.id, e.target.value), class: "px-2.5 py-1 text-xs bg-white border border-border rounded font-semibold text-brand", children: [_jsx("option", { value: "NEW", children: "NEW" }), _jsx("option", { value: "UNDER_REVIEW", children: "UNDER REVIEW" }), _jsx("option", { value: "PLANNED", children: "PLANNED" }), _jsx("option", { value: "IN_PROGRESS", children: "IN PROGRESS" }), _jsx("option", { value: "FIXED", children: "FIXED" }), _jsx("option", { value: "WONT_FIX", children: "WONT FIX" })] })] }), _jsx("div", { class: "flex items-center gap-3", children: _jsx("button", { onClick: () => handleTogglePin(selectedItem.id, selectedItem.isPinned), class: `px-3 py-1 rounded border text-xs font-semibold ${selectedItem.isPinned
                                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                    : 'bg-white text-text-sub border-border hover:text-text-main'}`, children: selectedItem.isPinned ? 'Pinned to Top' : 'Pin to Top' }) })] }), _jsxs("div", { class: "space-y-1.5", children: [_jsx("h4", { class: "text-xs font-bold text-text-sub uppercase tracking-wider", children: "Report Description" }), _jsx("div", { class: "bg-surface border border-border rounded-xl p-4 whitespace-pre-wrap leading-relaxed", children: selectedItem.description })] }), selectedItem.screenshotUrl && (_jsxs("div", { class: "space-y-1.5", children: [_jsx("h4", { class: "text-xs font-bold text-text-sub uppercase tracking-wider", children: "Attached Screenshot" }), _jsxs("div", { class: "p-2 bg-background border border-border rounded-xl inline-block max-w-sm", children: [_jsx("img", { src: getApiUrl(selectedItem.screenshotUrl), alt: "Tester bug screenshot", class: "rounded-lg max-h-48 cursor-pointer object-cover hover:opacity-90 transition-opacity", onClick: () => setZoomImage(getApiUrl(selectedItem.screenshotUrl)) }), _jsx("span", { class: "block text-[10px] text-text-sub mt-1 text-center", children: "Click to zoom full image" })] })] })), _jsxs("div", { class: "space-y-3 pt-4 border-t border-border", children: [_jsxs("h4", { class: "text-xs font-bold text-text-main uppercase tracking-wider flex items-center justify-between", children: [_jsxs("span", { children: ["Discussion Comments (", comments.length, ")"] }), loadingDetail && _jsx("span", { class: "text-text-sub font-normal", children: "Refreshing..." })] }), comments.length === 0 ? (_jsx("p", { class: "text-text-sub text-xs italic", children: "No comments posted yet." })) : (_jsx("div", { class: "space-y-2", children: comments.map((c) => (_jsxs("div", { class: `p-3 rounded-xl border text-xs ${c.moderationStatus === 'FLAGGED'
                                                    ? 'bg-red-50 border-red-200 text-red-900'
                                                    : c.isAdmin
                                                        ? 'bg-emerald-50/50 border-emerald-200'
                                                        : 'bg-background border-border'}`, children: [_jsxs("div", { class: "flex items-center justify-between gap-2 mb-1", children: [_jsxs("div", { class: "flex items-center gap-1.5", children: [_jsx("strong", { class: "text-text-main", children: c.authorName }), c.isAdmin && (_jsx("span", { class: "px-1.5 py-0.2 bg-emerald-700 text-white rounded text-[9px] font-bold", children: "OFFICIAL" })), _jsx("span", { class: "text-[10px] text-text-sub", children: new Date(c.createdAt).toLocaleDateString('en-IN', {
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        }) })] }), _jsxs("div", { class: "flex items-center gap-1.5", children: [_jsx("span", { class: `text-[10px] font-bold px-1.5 py-0.5 rounded ${c.moderationStatus === 'APPROVED'
                                                                            ? 'text-emerald-700 bg-emerald-100'
                                                                            : 'text-red-700 bg-red-100'}`, children: c.moderationStatus }), c.moderationStatus === 'FLAGGED' ? (_jsx("button", { onClick: () => handleModerateComment(c.id, 'APPROVED'), class: "px-2 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded text-[10px] font-semibold hover:bg-emerald-50", children: "Approve" })) : (_jsx("button", { onClick: () => handleModerateComment(c.id, 'FLAGGED'), class: "px-2 py-0.5 bg-white border border-red-300 text-red-700 rounded text-[10px] font-semibold hover:bg-red-50", children: "Flag / Hide" }))] })] }), _jsx("p", { class: "whitespace-pre-wrap mt-1", children: c.message })] }, c.id))) })), _jsxs("form", { onSubmit: handleAdminReplySubmit, class: "mt-4 pt-4 border-t border-border space-y-2", children: [_jsx("h5", { class: "text-xs font-bold text-text-main", children: "Post Official Developer Response" }), replyError && _jsx("p", { class: "text-xs text-red-600", children: replyError }), _jsx("textarea", { rows: 3, value: adminReply, onInput: (e) => setAdminReply(e.target.value), placeholder: "Write an official update (e.g. 'Fix deployed in v2 release', 'We could not reproduce on Android 12, can you clarify?')...", class: "w-full p-2.5 text-xs bg-background border border-border rounded-lg text-text-main focus:outline-none focus:ring-1 focus:ring-brand" }), _jsx("div", { class: "flex justify-end", children: _jsx("button", { type: "submit", disabled: submittingReply || !adminReply.trim(), class: "px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50", children: submittingReply ? 'Posting...' : 'Post Official Reply' }) })] })] })] }), _jsx("div", { class: "px-6 py-3 bg-background border-t border-border flex justify-end", children: _jsx("button", { onClick: () => setSelectedItem(null), class: "px-4 py-1.5 bg-surface border border-border text-xs font-semibold rounded-lg hover:bg-slate-100", children: "Close" }) })] }) })), zoomImage && (_jsx("div", { class: "fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4", onClick: () => setZoomImage(null), children: _jsxs("div", { class: "relative max-w-4xl max-h-[90vh]", children: [_jsx("img", { src: zoomImage, alt: "Zoomed screenshot", class: "max-w-full max-h-[85vh] rounded-lg shadow-2xl" }), _jsx("button", { onClick: () => setZoomImage(null), class: "absolute top-2 right-2 px-3 py-1 bg-black/60 text-white rounded text-xs font-bold", children: "Close" })] }) }))] }));
}
