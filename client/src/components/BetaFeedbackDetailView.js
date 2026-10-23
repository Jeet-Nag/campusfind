import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useState } from 'preact/hooks';
import { selectedFeedback, selectedFeedbackComments, isCommentsLoading, isSubmitting, submitComment, reportFeedbackItem, navigateBeta, } from '../state/beta';
import { t } from '../state/language';
import { getApiUrl } from '../config/api';
export function BetaFeedbackDetailView() {
    const item = selectedFeedback.value;
    const comments = selectedFeedbackComments.value;
    const loading = isCommentsLoading.value;
    const submitting = isSubmitting.value;
    const [authorName, setAuthorName] = useState('');
    const [message, setMessage] = useState('');
    const [commentError, setCommentError] = useState(null);
    const [commentSuccess, setCommentSuccess] = useState(false);
    const [reported, setReported] = useState(false);
    const [zoomImage, setZoomImage] = useState(null);
    if (loading && !item) {
        return (_jsxs("div", { class: "max-w-4xl mx-auto px-4 py-16 text-center space-y-3", children: [_jsx("div", { class: "w-8 h-8 mx-auto border-3 border-brand border-t-transparent rounded-full animate-spin" }), _jsx("p", { class: "text-xs text-text-sub", children: "Loading discussion..." })] }));
    }
    if (!item) {
        return (_jsxs("div", { class: "max-w-4xl mx-auto px-4 py-16 text-center space-y-4", children: [_jsx("h2", { class: "text-lg font-bold text-text-main", children: "Discussion Not Found" }), _jsx("p", { class: "text-xs text-text-sub", children: "This feedback item may have been moved or removed." }), _jsx("button", { onClick: () => navigateBeta('feedback'), class: "px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg", children: "\u2190 Back to Feedback Board" })] }));
    }
    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        setCommentError(null);
        if (!authorName.trim()) {
            setCommentError('Please enter your name.');
            return;
        }
        if (!message.trim()) {
            setCommentError('Please enter a response message.');
            return;
        }
        const ok = await submitComment(item.id, authorName.trim(), message.trim());
        if (ok) {
            setMessage('');
            setCommentSuccess(true);
            setTimeout(() => setCommentSuccess(false), 3000);
        }
    };
    const handleReport = async () => {
        if (reported)
            return;
        const ok = await reportFeedbackItem(item.id);
        if (ok) {
            setReported(true);
        }
    };
    const formatDate = (isoString) => {
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        }
        catch {
            return '';
        }
    };
    return (_jsxs("div", { class: "max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8", children: [_jsxs("div", { class: "flex items-center justify-between", children: [_jsx("button", { onClick: () => navigateBeta('feedback'), class: "text-xs font-semibold text-text-sub hover:text-brand flex items-center gap-1 cursor-pointer", children: "\u2190 Back to Feedback Board" }), _jsx("button", { onClick: handleReport, disabled: reported, class: "text-xs text-text-sub hover:text-danger font-medium cursor-pointer", children: reported ? '✓ Reported for Review' : '🚩 Report Inappropriate' })] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-5", children: [_jsxs("div", { class: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { class: "px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800", children: item.category.replace(/_/g, ' ') }), _jsxs("span", { class: "px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800", children: ["Status: ", item.status] }), _jsxs("span", { class: "text-xs font-mono text-text-sub bg-slate-50 border border-border px-2 py-0.5 rounded", children: ["Version ", item.appVersion] }), _jsxs("span", { class: "text-xs text-text-sub capitalize", children: ["Role: ", item.testerRole] })] }), _jsx("h1", { class: "text-xl sm:text-2xl font-black text-text-main leading-tight", children: item.title }), _jsx("div", { class: "bg-slate-50 border border-border/80 rounded-lg p-5 text-sm text-text-main leading-relaxed whitespace-pre-line", children: item.description }), item.screenshotUrl && (_jsxs("div", { class: "space-y-2 pt-2", children: [_jsx("span", { class: "text-xs font-bold text-text-sub uppercase tracking-wider block", children: "Attached Screenshot" }), _jsx("div", { class: "inline-block border border-border rounded-lg overflow-hidden bg-slate-100 cursor-zoom-in", children: _jsx("img", { src: getApiUrl(item.screenshotUrl), alt: "Tester screenshot", onClick: () => setZoomImage(getApiUrl(item.screenshotUrl)), class: "max-w-xs max-h-64 object-contain rounded hover:opacity-90 transition-opacity" }) }), _jsx("p", { class: "text-[11px] text-text-sub", children: "Click image to inspect full-size." })] })), _jsxs("div", { class: "pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-text-sub", children: [_jsxs("div", { children: ["Submitted by ", _jsx("span", { class: "font-bold text-text-main", children: item.authorName }), item.deviceModel && ` on ${item.deviceModel}`, item.androidVersion && ` (${item.androidVersion})`] }), _jsx("div", { children: formatDate(item.createdAt) })] })] }), _jsxs("div", { class: "space-y-6", children: [_jsxs("div", { class: "flex items-center justify-between border-b border-border pb-3", children: [_jsxs("h2", { class: "text-lg font-bold text-text-main", children: [t('beta.comments_heading'), " (", comments.length, ")"] }), _jsx("span", { class: "text-xs text-text-sub", children: "Public beta discussion" })] }), comments.length === 0 ? (_jsx("div", { class: "p-8 text-center bg-surface border border-border rounded-xl text-xs text-text-sub", children: "No replies posted yet. Share your thoughts or confirm this bug below!" })) : (_jsx("div", { class: "space-y-3", children: comments.map((comment) => (_jsxs("div", { class: `p-4 rounded-xl border ${comment.isAdmin
                                ? 'bg-blue-50/70 border-blue-200'
                                : 'bg-surface border-border'} space-y-2`, children: [_jsxs("div", { class: "flex items-center justify-between text-xs", children: [_jsxs("div", { class: "flex items-center gap-2", children: [_jsx("span", { class: "font-bold text-text-main", children: comment.authorName }), comment.isAdmin && (_jsx("span", { class: "px-2 py-0.5 rounded text-[10px] font-bold bg-brand text-white", children: "TEAM / ADMIN" }))] }), _jsx("span", { class: "text-text-sub", children: formatDate(comment.createdAt) })] }), _jsx("p", { class: "text-xs text-text-main leading-relaxed whitespace-pre-line", children: comment.message })] }, comment.id))) })), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-5 shadow-xs space-y-4", children: [_jsx("h3", { class: "text-sm font-bold text-text-main", children: "Add to the Discussion" }), commentSuccess && (_jsx("div", { class: "p-3 rounded-lg bg-green-50 border border-green-200 text-action text-xs font-semibold", children: "\u2713 Reply posted successfully." })), commentError && (_jsxs("div", { class: "p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-xs font-semibold", children: ["\u26A0\uFE0F ", commentError] })), _jsxs("form", { onSubmit: handleCommentSubmit, class: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1", children: "Your Name" }), _jsx("input", { type: "text", required: true, placeholder: "e.g. Priya Sharma", value: authorName, onInput: (e) => setAuthorName(e.target.value), disabled: submitting, class: "w-full px-3.5 py-2 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand" })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1", children: "Response" }), _jsx("textarea", { required: true, rows: 3, placeholder: t('beta.add_comment_placeholder'), value: message, onInput: (e) => setMessage(e.target.value), disabled: submitting, class: "w-full px-3.5 py-2 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand leading-relaxed" })] }), _jsx("div", { class: "flex justify-end", children: _jsx("button", { type: "submit", disabled: submitting, class: "min-h-[40px] px-5 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50", children: submitting ? 'Posting...' : t('beta.add_comment_btn') }) })] })] })] }), zoomImage && (_jsx("div", { class: "fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out", onClick: () => setZoomImage(null), children: _jsxs("div", { class: "relative max-w-4xl max-h-[90vh]", children: [_jsx("img", { src: zoomImage, alt: "Zoomed screenshot", class: "max-w-full max-h-[90vh] object-contain rounded" }), _jsx("button", { class: "absolute top-2 right-2 text-white bg-black/60 px-3 py-1 rounded-full text-xs font-bold", onClick: () => setZoomImage(null), children: "\u2715 Close" })] }) }))] }));
}
