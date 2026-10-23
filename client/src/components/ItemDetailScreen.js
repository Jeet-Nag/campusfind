import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect, useState } from 'preact/hooks';
import { activeItem, activeItemClaims, itemDetailLoading, itemDetailError, fetchItemDetail, submitClaimRequest, reviewClaimRequest, updateItemReport, deleteItemReport, navigateTo, showNotification, } from '../state/campus';
import { currentUser, isAuthenticated } from '../state/auth';
import { CAMPUS_CATEGORIES } from '@shared';
export function ItemDetailScreen({ itemId }) {
    // Claim submission form state
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [claimantName, setClaimantName] = useState(currentUser.value?.fullName || '');
    const [claimantContact, setClaimantContact] = useState(currentUser.value?.email || '');
    const [distinguishingFeature, setDistinguishingFeature] = useState('');
    const [claimMessage, setClaimMessage] = useState('');
    const [claimError, setClaimError] = useState(null);
    const [submittingClaim, setSubmittingClaim] = useState(false);
    // Owner claim review response
    const [reviewingClaimId, setReviewingClaimId] = useState(null);
    const [ownerResponseMessage, setOwnerResponseMessage] = useState('');
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    useEffect(() => {
        if (itemId) {
            fetchItemDetail(itemId);
        }
    }, [itemId, currentUser.value?.id]);
    if (itemDetailLoading.value) {
        return (_jsxs("div", { class: "max-w-2xl mx-auto py-12 text-center space-y-4", children: [_jsx("div", { class: "w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto" }), _jsx("p", { class: "text-xs text-text-sub font-semibold", children: "Loading item details..." })] }));
    }
    if (itemDetailError.value || !activeItem.value) {
        return (_jsxs("div", { class: "max-w-md mx-auto my-12 bg-surface border border-border rounded-2xl p-8 text-center space-y-3", children: [_jsx("div", { class: "text-3xl", children: "\u26A0\uFE0F" }), _jsx("h2", { class: "text-base font-bold text-text-main", children: "Item Not Found" }), _jsx("p", { class: "text-xs text-text-sub", children: itemDetailError.value || 'This report may have been deleted or does not exist.' }), _jsx("button", { onClick: () => navigateTo('browse'), class: "px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors", children: "Back to Browse Items" })] }));
    }
    const item = activeItem.value;
    const isOwner = currentUser.value?.id === item.userId;
    const isLost = item.type === 'lost';
    const catInfo = CAMPUS_CATEGORIES.find((c) => c.id === item.category);
    // Submit Claim handler
    const handleSubmitClaim = async (e) => {
        e.preventDefault();
        if (!distinguishingFeature.trim() || distinguishingFeature.trim().length < 5) {
            setClaimError('Please describe a distinguishing feature (at least 5 characters).');
            return;
        }
        if (!claimantContact.trim()) {
            setClaimError('Please provide your campus email or phone.');
            return;
        }
        setSubmittingClaim(true);
        setClaimError(null);
        const res = await submitClaimRequest(item.id, {
            claimantName: claimantName.trim() || 'Student Claimant',
            claimantContact: claimantContact.trim(),
            distinguishingFeature: distinguishingFeature.trim(),
            message: claimMessage.trim() || undefined,
        });
        setSubmittingClaim(false);
        if (res.success) {
            setShowClaimModal(false);
            setDistinguishingFeature('');
            setClaimMessage('');
            showNotification('Your claim has been submitted to the reporter!', 'success');
        }
        else {
            setClaimError(res.error || 'Failed to submit claim.');
        }
    };
    // Review Claim handler (Owner accept/reject)
    const handleReviewClaim = async (claimId, status) => {
        setReviewSubmitting(true);
        const res = await reviewClaimRequest(claimId, status, ownerResponseMessage || undefined);
        setReviewSubmitting(false);
        if (res.success) {
            setReviewingClaimId(null);
            setOwnerResponseMessage('');
            showNotification(status === 'accepted'
                ? 'Claim accepted! Communication instructions sent.'
                : 'Claim declined.', 'info');
        }
        else {
            showNotification(res.error || 'Failed to review claim.', 'error');
        }
    };
    // Update Item Status handler (Owner mark returned / reopen)
    const handleStatusChange = async (newStatus) => {
        const res = await updateItemReport(item.id, { status: newStatus });
        if (res.success) {
            showNotification(`Item marked as ${newStatus.replace('_', ' ')}.`, 'success');
        }
        else {
            showNotification(res.error || 'Failed to update status.', 'error');
        }
    };
    // Delete Item handler
    const handleDeleteItem = async () => {
        if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
            return;
        }
        const res = await deleteItemReport(item.id);
        if (res.success) {
            showNotification('Report deleted successfully.', 'info');
            navigateTo('browse');
        }
        else {
            showNotification(res.error || 'Failed to delete report.', 'error');
        }
    };
    return (_jsxs("div", { class: "max-w-2xl mx-auto pb-16 space-y-6", children: [_jsxs("button", { onClick: () => navigateTo('browse'), class: "inline-flex items-center gap-1.5 text-xs font-semibold text-text-sub hover:text-brand transition-colors", children: [_jsx("span", { children: "\u2190" }), " Back to Browse"] }), _jsxs("div", { class: "bg-surface border border-border rounded-2xl overflow-hidden shadow-xs", children: [_jsxs("div", { class: "h-64 sm:h-72 bg-slate-100 relative overflow-hidden flex items-center justify-center", children: [item.imageUrl ? (_jsx("img", { src: item.imageUrl, alt: item.title, class: "w-full h-full object-cover" })) : (_jsxs("div", { class: "flex flex-col items-center justify-center text-slate-400", children: [_jsx("span", { class: "text-6xl mb-2", children: catInfo?.icon || '📦' }), _jsx("span", { class: "text-xs font-semibold uppercase tracking-wider", children: catInfo?.label })] })), _jsx("div", { class: "absolute top-4 left-4", children: _jsx("span", { class: `text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-md shadow-sm ${isLost ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`, children: isLost ? '📢 Lost Item' : '🎁 Found Item' }) }), _jsx("div", { class: "absolute top-4 right-4", children: _jsx("span", { class: `text-xs font-bold px-3 py-1 rounded-md shadow-sm backdrop-blur-md ${item.status === 'returned'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : item.status === 'claim_pending'
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                            : 'bg-white/95 text-text-sub border border-border'}`, children: item.status === 'returned'
                                        ? '✓ Returned / Resolved'
                                        : item.status === 'claim_pending'
                                            ? '⏳ Claim Pending'
                                            : '● Open' }) })] }), _jsxs("div", { class: "p-6 space-y-5", children: [_jsxs("div", { children: [_jsxs("div", { class: "flex items-center gap-2 text-xs font-semibold text-text-sub mb-1", children: [_jsx("span", { children: catInfo?.icon }), _jsx("span", { children: catInfo?.label })] }), _jsx("h1", { class: "text-2xl font-extrabold text-text-main leading-tight", children: item.title })] }), _jsxs("div", { class: "grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-border/70 rounded-xl text-xs", children: [_jsxs("div", { children: [_jsx("span", { class: "text-text-sub font-medium block", children: "Campus Location" }), _jsxs("span", { class: "text-text-main font-bold mt-0.5 block", children: ["\uD83D\uDCCD ", item.location] })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub font-medium block", children: isLost ? 'Date Lost' : 'Date Found' }), _jsxs("span", { class: "text-text-main font-bold mt-0.5 block", children: ["\uD83D\uDCC5 ", item.dateOccurred] })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub font-medium block", children: "Reported By" }), _jsxs("span", { class: "text-text-main font-bold mt-0.5 block", children: ["\uD83D\uDC64 ", item.reporterName || 'Campus Student'] })] }), _jsxs("div", { children: [_jsx("span", { class: "text-text-sub font-medium block", children: "Handoff / Contact Point" }), _jsxs("span", { class: "text-text-main font-bold mt-0.5 block", children: ["\uD83C\uDFE2 ", item.contactMethod] })] })] }), _jsxs("div", { class: "space-y-1.5", children: [_jsx("h3", { class: "text-xs font-bold text-text-main uppercase tracking-wider", children: "Description" }), _jsx("p", { class: "text-sm text-text-sub leading-relaxed whitespace-pre-line bg-background p-3.5 rounded-xl border border-border/60", children: item.description })] }), isOwner && item.isSensitive && item.sensitiveDetails && (_jsxs("div", { class: "p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1", children: [_jsxs("div", { class: "flex items-center gap-1.5 text-xs font-bold text-amber-900", children: [_jsx("span", { children: "\uD83D\uDD12" }), " Confidential Distinguishing Details (Private to You)"] }), _jsx("p", { class: "text-xs text-amber-800 leading-relaxed", children: item.sensitiveDetails }), _jsx("p", { class: "text-[10px] text-amber-700/80 mt-1", children: "This was hidden from public listings to protect confidential IDs or numbers. Use this to verify submitted claims below." })] })), !isOwner && (_jsxs("div", { class: "p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3", children: [_jsx("span", { class: "text-lg", children: "\uD83D\uDEE1\uFE0F" }), _jsxs("div", { class: "text-xs text-blue-900", children: [_jsx("span", { class: "font-bold", children: "Privacy Protected:" }), " Direct personal phone and email addresses are withheld to safeguard student privacy. If this item belongs to you, submit a claim below describing a distinguishing feature."] })] })), _jsx("div", { class: "pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3", children: isOwner ? (
                                /* Owner Actions */
                                _jsxs("div", { class: "w-full space-y-3", children: [_jsxs("div", { class: "text-xs font-bold text-text-main flex items-center justify-between", children: [_jsx("span", { children: "Manage Your Report:" }), _jsx("button", { onClick: handleDeleteItem, class: "text-xs font-semibold text-danger hover:underline", children: "Delete Report" })] }), _jsxs("div", { class: "flex flex-wrap gap-2", children: [_jsx("button", { onClick: () => handleStatusChange('returned'), disabled: item.status === 'returned', class: `px-4 py-2 text-xs font-bold rounded-xl transition-colors ${item.status === 'returned'
                                                        ? 'bg-emerald-100 text-emerald-800 cursor-default'
                                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`, children: "\u2713 Mark as Returned / Resolved" }), _jsx("button", { onClick: () => handleStatusChange('open'), disabled: item.status === 'open', class: `px-4 py-2 text-xs font-bold rounded-xl border border-border transition-colors ${item.status === 'open'
                                                        ? 'bg-slate-100 text-text-sub cursor-default'
                                                        : 'text-text-main hover:bg-slate-100'}`, children: "Set to Open" }), _jsx("button", { onClick: () => handleStatusChange('claim_pending'), disabled: item.status === 'claim_pending', class: `px-4 py-2 text-xs font-bold rounded-xl border border-border transition-colors ${item.status === 'claim_pending'
                                                        ? 'bg-blue-100 text-blue-800 cursor-default'
                                                        : 'text-text-main hover:bg-slate-100'}`, children: "Set to Claim Pending" })] })] })) : (
                                /* Non-Owner Claimant Actions */
                                _jsx("div", { class: "w-full flex items-center justify-between", children: isAuthenticated.value ? (_jsxs("button", { onClick: () => setShowClaimModal(true), disabled: item.status === 'returned', class: `w-full py-3.5 px-6 font-bold text-sm text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 ${item.status === 'returned'
                                            ? 'bg-slate-400 cursor-not-allowed'
                                            : 'bg-brand hover:bg-brand-dark'}`, children: [_jsx("span", { children: "\uD83E\uDD1D" }), item.status === 'returned'
                                                ? 'Item Already Returned'
                                                : isLost
                                                    ? 'I Found This Item (Contact Reporter)'
                                                    : 'Claim This Item (Prove Ownership)'] })) : (_jsx("button", { onClick: () => navigateTo('auth'), class: "w-full py-3.5 px-6 font-bold text-sm bg-brand hover:bg-brand-dark text-white rounded-xl shadow-xs transition-colors", children: "Sign In to Claim This Item" })) })) })] })] }), isOwner && (_jsxs("section", { class: "bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-xs space-y-4", children: [_jsxs("div", { class: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { class: "text-base font-bold text-text-main", children: "Submitted Claims & Verification Requests" }), _jsx("p", { class: "text-xs text-text-sub", children: "Review distinguishing feature proofs submitted by students" })] }), _jsxs("span", { class: "px-2.5 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-bold", children: [activeItemClaims.value.length, " ", activeItemClaims.value.length === 1 ? 'Claim' : 'Claims'] })] }), activeItemClaims.value.length === 0 ? (_jsx("div", { class: "p-6 bg-background rounded-xl border border-dashed border-border text-center", children: _jsx("p", { class: "text-xs text-text-sub font-medium", children: "No claims submitted yet for this item." }) })) : (_jsx("div", { class: "space-y-4", children: activeItemClaims.value.map((claim) => (_jsxs("div", { class: "p-4 bg-background border border-border rounded-xl space-y-3", children: [_jsxs("div", { class: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("div", { class: "text-sm font-bold text-text-main", children: claim.claimantName }), _jsxs("div", { class: "text-xs text-text-sub", children: ["Contact: ", _jsx("strong", { children: claim.claimantContact })] })] }), _jsx("span", { class: `text-[10px] font-bold px-2 py-0.5 rounded ${claim.status === 'accepted'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : claim.status === 'rejected'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : 'bg-amber-100 text-amber-800'}`, children: claim.status.toUpperCase() })] }), _jsxs("div", { class: "p-3 bg-white border border-border rounded-lg text-xs space-y-1", children: [_jsx("span", { class: "font-bold text-brand block", children: "Distinguishing Feature Proof:" }), _jsx("p", { class: "text-text-main leading-relaxed", children: claim.distinguishingFeature })] }), claim.message && (_jsxs("div", { class: "text-xs text-text-sub", children: [_jsx("strong", { children: "Note from claimant:" }), " ", claim.message] })), claim.ownerResponse && (_jsxs("div", { class: "text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200", children: [_jsx("strong", { children: "Your response:" }), " ", claim.ownerResponse] })), claim.status === 'pending' && (_jsxs("div", { class: "pt-2 flex items-center gap-2", children: [_jsx("button", { onClick: () => setReviewingClaimId(claim.id), class: "px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors", children: "Accept Claim" }), _jsx("button", { onClick: () => handleReviewClaim(claim.id, 'rejected'), class: "px-3.5 py-1.5 border border-border text-text-sub hover:text-danger hover:bg-slate-100 text-xs font-bold rounded-lg transition-colors", children: "Decline" })] })), reviewingClaimId === claim.id && (_jsxs("div", { class: "p-3 bg-white border border-emerald-200 rounded-lg space-y-2", children: [_jsx("label", { class: "block text-xs font-bold text-emerald-900", children: "Instructions / Meeting Point for Claimant:" }), _jsx("input", { type: "text", value: ownerResponseMessage, onInput: (e) => setOwnerResponseMessage(e.target.value), placeholder: "e.g. Can meet at Library Circulation Desk today at 3pm, or call me at...", class: "w-full px-3 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600 text-text-main" }), _jsxs("div", { class: "flex items-center gap-2", children: [_jsx("button", { onClick: () => handleReviewClaim(claim.id, 'accepted'), disabled: reviewSubmitting, class: "px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700", children: reviewSubmitting ? 'Confirming...' : 'Confirm Acceptance' }), _jsx("button", { onClick: () => setReviewingClaimId(null), class: "px-3 py-1.5 text-xs text-text-sub hover:text-text-main font-semibold", children: "Cancel" })] })] }))] }, claim.id))) }))] })), showClaimModal && (_jsx("div", { class: "fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4", children: _jsxs("div", { class: "bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { class: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h3", { class: "text-lg font-bold text-text-main", children: isLost ? 'Contact Item Reporter' : 'Submit Ownership Claim' }), _jsx("p", { class: "text-xs text-text-sub mt-0.5", children: "Prove ownership by describing secret distinguishing features." })] }), _jsx("button", { onClick: () => setShowClaimModal(false), class: "text-text-sub hover:text-text-main text-lg font-bold p-1", children: "\u2715" })] }), claimError && (_jsx("div", { class: "p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold", children: claimError })), _jsxs("form", { onSubmit: handleSubmitClaim, class: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main mb-1", children: ["Your Full Name ", _jsx("span", { class: "text-danger", children: "*" })] }), _jsx("input", { type: "text", value: claimantName, onInput: (e) => setClaimantName(e.target.value), class: "w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main", required: true })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main mb-1", children: ["Your Campus Email or Phone ", _jsx("span", { class: "text-danger", children: "*" })] }), _jsx("input", { type: "text", value: claimantContact, onInput: (e) => setClaimantContact(e.target.value), placeholder: "e.g. student@campus.edu or 9876543210", class: "w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main", required: true })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main mb-1", children: ["Distinguishing Feature Proof ", _jsx("span", { class: "text-danger", children: "*" })] }), _jsx("textarea", { rows: 3, value: distinguishingFeature, onInput: (e) => setDistinguishingFeature(e.target.value), placeholder: "Describe a distinguishing feature NOT visible in public photos (e.g. lock screen wallpaper, specific sticker, engraving, dent, scratch, serial number, inside contents)...", class: "w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main", required: true }), _jsx("p", { class: "text-[11px] text-text-sub mt-1", children: "\uD83D\uDEE1\uFE0F This description is only shared with the person who reported the item to verify legitimate ownership." })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main mb-1", children: "Message / Pickup Arrangement (Optional)" }), _jsx("input", { type: "text", value: claimMessage, onInput: (e) => setClaimMessage(e.target.value), placeholder: "e.g. I can meet at the library desk between 2-4 PM today.", class: "w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main" })] }), _jsxs("div", { class: "pt-2 flex items-center justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setShowClaimModal(false), class: "px-4 py-2.5 text-xs text-text-sub hover:text-text-main font-semibold", children: "Cancel" }), _jsx("button", { type: "submit", disabled: submittingClaim, class: "px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors shadow-xs", children: submittingClaim ? 'Submitting Claim...' : 'Send Claim Request' })] })] })] }) }))] }));
}
