import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect, useState } from 'preact/hooks';
import { myReports, myClaims, myReportsLoading, myReportsError, fetchMyReports, updateItemReport, deleteItemReport, navigateTo, showNotification, } from '../state/campus';
import { currentUser, isAuthenticated } from '../state/auth';
import { CAMPUS_CATEGORIES } from '@shared';
export function MyReportsScreen() {
    const [activeTab, setActiveTab] = useState('reports');
    const [editingItemId, setEditingItemId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editContact, setEditContact] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    useEffect(() => {
        if (isAuthenticated.value) {
            fetchMyReports();
        }
    }, [isAuthenticated.value]);
    if (!isAuthenticated.value) {
        return (_jsxs("div", { class: "max-w-md mx-auto my-12 bg-surface border border-border rounded-2xl p-8 text-center space-y-4", children: [_jsx("div", { class: "text-4xl", children: "\uD83D\uDC64" }), _jsx("h2", { class: "text-lg font-bold text-text-main", children: "Sign In Required" }), _jsx("p", { class: "text-xs text-text-sub", children: "Please sign in to view and manage your reported items and claims." }), _jsx("button", { onClick: () => navigateTo('auth'), class: "px-5 py-2.5 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors shadow-xs", children: "Sign In" })] }));
    }
    const handleStatusChange = async (itemId, status) => {
        const res = await updateItemReport(itemId, { status });
        if (res.success) {
            showNotification(`Item status updated to ${status.replace('_', ' ')}.`, 'success');
            fetchMyReports();
        }
        else {
            showNotification(res.error || 'Failed to update status.', 'error');
        }
    };
    const handleDeleteItem = async (itemId) => {
        if (!confirm('Are you sure you want to delete this report?'))
            return;
        const res = await deleteItemReport(itemId);
        if (res.success) {
            showNotification('Report deleted successfully.', 'info');
            fetchMyReports();
        }
        else {
            showNotification(res.error || 'Failed to delete report.', 'error');
        }
    };
    const startEditing = (item) => {
        setEditingItemId(item.id);
        setEditTitle(item.title);
        setEditDescription(item.description);
        setEditContact(item.contactMethod);
    };
    const handleSaveEdit = async (itemId) => {
        setSavingEdit(true);
        const res = await updateItemReport(itemId, {
            title: editTitle.trim(),
            description: editDescription.trim(),
            contactMethod: editContact.trim(),
        });
        setSavingEdit(false);
        if (res.success) {
            setEditingItemId(null);
            showNotification('Report updated successfully.', 'success');
            fetchMyReports();
        }
        else {
            showNotification(res.error || 'Failed to update report.', 'error');
        }
    };
    return (_jsxs("div", { class: "max-w-3xl mx-auto pb-16 space-y-6", children: [_jsxs("div", { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { class: "text-2xl font-extrabold text-brand tracking-tight", children: "My Campus Dashboard" }), _jsxs("p", { class: "text-xs text-text-sub mt-0.5", children: ["Logged in as ", _jsx("strong", { children: currentUser.value?.fullName }), " (", currentUser.value?.email, ")"] })] }), _jsxs("div", { class: "flex items-center gap-2", children: [_jsx("button", { onClick: () => navigateTo('report-lost'), class: "px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-2xs", children: "+ Report Lost" }), _jsx("button", { onClick: () => navigateTo('report-found'), class: "px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs", children: "+ Report Found" })] })] }), _jsxs("div", { class: "flex items-center p-1 bg-slate-100 rounded-xl max-w-sm", children: [_jsxs("button", { onClick: () => setActiveTab('reports'), class: `flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'reports'
                            ? 'bg-white text-text-main shadow-xs'
                            : 'text-text-sub hover:text-text-main'}`, children: [_jsx("span", { children: "\uD83D\uDCCB" }), " My Reports (", myReports.value.length, ")"] }), _jsxs("button", { onClick: () => setActiveTab('claims'), class: `flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'claims'
                            ? 'bg-white text-text-main shadow-xs'
                            : 'text-text-sub hover:text-text-main'}`, children: [_jsx("span", { children: "\uD83E\uDD1D" }), " My Claims (", myClaims.value.length, ")"] })] }), myReportsLoading.value ? (_jsx("div", { class: "py-12 text-center text-xs text-text-sub font-semibold", children: "Loading your campus dashboard..." })) : myReportsError.value ? (_jsx("div", { class: "p-4 bg-rose-50 text-rose-800 rounded-xl text-xs", children: myReportsError.value })) : activeTab === 'reports' ? (
            /* Tab 1: My Reported Items */
            myReports.value.length === 0 ? (_jsxs("div", { class: "bg-surface border border-border rounded-2xl p-10 text-center space-y-3", children: [_jsx("div", { class: "text-3xl", children: "\uD83D\uDCED" }), _jsx("h3", { class: "text-sm font-bold text-text-main", children: "No Reports Posted Yet" }), _jsx("p", { class: "text-xs text-text-sub", children: "You haven't posted any lost or found items on CampusFind yet." }), _jsxs("div", { class: "pt-2 flex items-center justify-center gap-2", children: [_jsx("button", { onClick: () => navigateTo('report-lost'), class: "px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors", children: "Report Lost Item" }), _jsx("button", { onClick: () => navigateTo('report-found'), class: "px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors", children: "Report Found Item" })] })] })) : (_jsx("div", { class: "space-y-4", children: myReports.value.map((item) => {
                    const isLost = item.type === 'lost';
                    const catInfo = CAMPUS_CATEGORIES.find((c) => c.id === item.category);
                    return (_jsxs("div", { class: "bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4 transition-all", children: [_jsxs("div", { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-2", children: [_jsxs("div", { class: "flex items-center gap-2.5", children: [_jsx("span", { class: `text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${isLost ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`, children: isLost ? 'Lost' : 'Found' }), _jsxs("span", { class: "text-xs font-semibold text-text-sub", children: [catInfo?.icon, " ", catInfo?.label] }), _jsxs("span", { class: "text-xs text-text-sub", children: ["\u2022 \uD83D\uDCC5 ", item.dateOccurred] })] }), _jsx("div", { children: _jsxs("span", { class: `text-xs font-bold px-2.5 py-1 rounded-md ${item.status === 'returned'
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                : item.status === 'claim_pending'
                                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                    : 'bg-slate-100 text-slate-800 border border-border'}`, children: ["Status: ", item.status === 'returned' ? '✓ Returned' : item.status === 'claim_pending' ? '⏳ Claim Pending' : '● Open'] }) })] }), editingItemId === item.id ? (_jsxs("div", { class: "space-y-3 p-3 bg-slate-50 border border-border rounded-xl", children: [_jsxs("div", { children: [_jsx("label", { class: "block text-[11px] font-bold text-text-main mb-1", children: "Item Title" }), _jsx("input", { type: "text", value: editTitle, onInput: (e) => setEditTitle(e.target.value), class: "w-full px-3 py-1.5 bg-white border border-border rounded-lg text-xs" })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-[11px] font-bold text-text-main mb-1", children: "Description" }), _jsx("textarea", { rows: 2, value: editDescription, onInput: (e) => setEditDescription(e.target.value), class: "w-full px-3 py-1.5 bg-white border border-border rounded-lg text-xs" })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-[11px] font-bold text-text-main mb-1", children: "Contact Method" }), _jsx("input", { type: "text", value: editContact, onInput: (e) => setEditContact(e.target.value), class: "w-full px-3 py-1.5 bg-white border border-border rounded-lg text-xs" })] }), _jsxs("div", { class: "flex items-center gap-2 pt-1", children: [_jsx("button", { onClick: () => handleSaveEdit(item.id), disabled: savingEdit, class: "px-3.5 py-1.5 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-dark", children: savingEdit ? 'Saving...' : 'Save Changes' }), _jsx("button", { onClick: () => setEditingItemId(null), class: "px-3.5 py-1.5 text-xs text-text-sub hover:text-text-main", children: "Cancel" })] })] })) : (_jsxs("div", { children: [_jsx("h3", { onClick: () => navigateTo('item-detail', item.id), class: "text-base font-bold text-text-main hover:text-brand cursor-pointer transition-colors", children: item.title }), _jsx("p", { class: "text-xs text-text-sub mt-1 leading-relaxed", children: item.description }), _jsxs("div", { class: "text-[11px] text-text-sub mt-2", children: [_jsxs("span", { children: ["\uD83D\uDCCD Location: ", _jsx("strong", { children: item.location })] }), " |", ' ', _jsxs("span", { children: ["Claims received: ", _jsx("strong", { children: item.claimsCount || 0 })] })] })] })), _jsxs("div", { class: "pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { class: "flex items-center gap-1.5", children: [_jsxs("button", { onClick: () => navigateTo('item-detail', item.id), class: "px-3 py-1.5 text-xs font-bold bg-brand/10 hover:bg-brand/20 text-brand rounded-lg transition-colors", children: ["View Details & Claims (", item.claimsCount || 0, ")"] }), _jsx("button", { onClick: () => startEditing(item), class: "px-3 py-1.5 text-xs font-semibold border border-border hover:bg-slate-100 text-text-sub rounded-lg transition-colors", children: "Edit" }), _jsx("button", { onClick: () => handleDeleteItem(item.id), class: "px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-rose-50 rounded-lg transition-colors", children: "Delete" })] }), _jsx("div", { class: "flex items-center gap-1.5", children: item.status !== 'returned' ? (_jsx("button", { onClick: () => handleStatusChange(item.id, 'returned'), class: "px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs", children: "\u2713 Mark Returned" })) : (_jsx("button", { onClick: () => handleStatusChange(item.id, 'open'), class: "px-3 py-1.5 text-xs font-semibold border border-border text-text-sub hover:bg-slate-100 rounded-lg transition-colors", children: "Reopen Item" })) })] })] }, item.id));
                }) }))) : (
            /* Tab 2: My Claims */
            myClaims.value.length === 0 ? (_jsxs("div", { class: "bg-surface border border-border rounded-2xl p-10 text-center space-y-3", children: [_jsx("div", { class: "text-3xl", children: "\uD83E\uDD1D" }), _jsx("h3", { class: "text-sm font-bold text-text-main", children: "No Claims Submitted" }), _jsx("p", { class: "text-xs text-text-sub", children: "When you find a lost or found item that belongs to you, you can submit a claim." }), _jsx("button", { onClick: () => navigateTo('browse'), class: "px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-dark transition-colors", children: "Browse Campus Items" })] })) : (_jsx("div", { class: "space-y-4", children: myClaims.value.map((claim) => (_jsxs("div", { class: "bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-3", children: [_jsxs("div", { class: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsxs("span", { class: "text-[10px] font-bold uppercase tracking-wider text-text-sub block", children: ["Claim for ", claim.itemType?.toUpperCase() || 'ITEM'] }), _jsx("h3", { onClick: () => navigateTo('item-detail', claim.itemId), class: "text-sm font-bold text-text-main hover:text-brand cursor-pointer transition-colors", children: claim.itemTitle || 'Campus Item' }), _jsxs("div", { class: "text-[11px] text-text-sub mt-0.5", children: ["\uD83D\uDCCD ", claim.itemLocation || 'Campus', " \u2022 Submitted on ", claim.createdAt.split('T')[0]] })] }), _jsx("span", { class: `text-xs font-bold px-2.5 py-1 rounded-md ${claim.status === 'accepted'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : claim.status === 'rejected'
                                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                            : 'bg-amber-100 text-amber-800 border border-amber-300'}`, children: claim.status === 'accepted'
                                        ? '✓ Accepted'
                                        : claim.status === 'rejected'
                                            ? '✕ Declined'
                                            : '⏳ Pending Review' })] }), _jsxs("div", { class: "p-3 bg-background border border-border rounded-xl text-xs space-y-1", children: [_jsx("span", { class: "text-text-sub font-semibold block", children: "Your Distinguishing Proof:" }), _jsx("p", { class: "text-text-main", children: claim.distinguishingFeature })] }), claim.ownerResponse && (_jsxs("div", { class: "p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1", children: [_jsx("span", { class: "font-bold block", children: "Response from Reporter:" }), _jsx("p", { children: claim.ownerResponse })] })), _jsx("div", { class: "pt-2 flex justify-end", children: _jsx("button", { onClick: () => navigateTo('item-detail', claim.itemId), class: "text-xs font-bold text-brand hover:underline", children: "View Item Page \u2192" }) })] }, claim.id))) })))] }));
}
