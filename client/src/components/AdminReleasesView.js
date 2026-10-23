import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useState, useEffect } from 'preact/hooks';
import { authToken } from '../state/auth';
import { getApiUrl } from '../config/api';
export function AdminReleasesView() {
    const [releases, setReleases] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    // Upload modal state
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [changelog, setChangelog] = useState('');
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [uploadSuccess, setUploadSuccess] = useState(null);
    // Withdraw modal state
    const [withdrawTarget, setWithdrawTarget] = useState(null);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);
    const [withdrawError, setWithdrawError] = useState(null);
    const token = authToken.value;
    const loadData = async () => {
        if (!token)
            return;
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch releases
            const res = await fetch(getApiUrl('/api/admin/beta/releases'), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.data) {
                setReleases(data.data.releases);
            }
            // 2. Fetch analytics
            const anaRes = await fetch(getApiUrl('/api/admin/beta/analytics'), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const anaData = await anaRes.json();
            if (anaData.success && anaData.data) {
                setAnalytics(anaData.data);
            }
            // 3. Fetch audit logs
            const auditRes = await fetch(getApiUrl('/api/admin/beta/audit-logs'), {
                headers: { Authorization: `Bearer ${token}` },
            });
            const auditData = await auditRes.json();
            if (auditData.success && auditData.data) {
                setAuditLogs(auditData.data.logs || []);
            }
        }
        catch (err) {
            setError(err.message || 'Failed to load release management data.');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadData();
    }, [token]);
    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            setUploadError('Please select an APK file.');
            return;
        }
        if (!changelog.trim()) {
            setUploadError('Please enter release notes.');
            return;
        }
        setUploadLoading(true);
        setUploadError(null);
        setUploadSuccess(null);
        try {
            const formData = new FormData();
            formData.append('apk', uploadFile);
            formData.append('changelog', changelog.trim());
            const res = await fetch(getApiUrl('/api/admin/beta/releases/upload'), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setUploadError(json.error?.messageEn || 'Failed to upload and validate APK.');
                return;
            }
            setUploadSuccess(`Release ${json.data.release.versionDisplay} uploaded in draft status.`);
            setUploadFile(null);
            setChangelog('');
            setTimeout(() => {
                setIsUploadOpen(false);
                setUploadSuccess(null);
                loadData();
            }, 1500);
        }
        catch (err) {
            setUploadError(err.message || 'Network error during upload.');
        }
        finally {
            setUploadLoading(false);
        }
    };
    const handlePublish = async (release) => {
        if (!confirm(`Are you sure you want to publish ${release.versionDisplay} as the active latest download?`)) {
            return;
        }
        try {
            const res = await fetch(getApiUrl(`/api/admin/beta/releases/${release.id}/publish`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            });
            const json = await res.json();
            if (json.success) {
                loadData();
            }
            else {
                alert(json.error?.messageEn || 'Failed to publish release.');
            }
        }
        catch (err) {
            alert(err.message || 'Error publishing release.');
        }
    };
    const handleWithdrawConfirm = async (e) => {
        e.preventDefault();
        if (!withdrawTarget)
            return;
        if (!withdrawReason.trim() || withdrawReason.trim().length < 3) {
            setWithdrawError('Please enter a reason for withdrawal (at least 3 characters).');
            return;
        }
        setWithdrawLoading(true);
        setWithdrawError(null);
        try {
            const res = await fetch(getApiUrl(`/api/admin/beta/releases/${withdrawTarget.id}/withdraw`), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason: withdrawReason.trim() }),
            });
            const json = await res.json();
            if (json.success) {
                setWithdrawTarget(null);
                setWithdrawReason('');
                loadData();
            }
            else {
                setWithdrawError(json.error?.messageEn || 'Failed to withdraw release.');
            }
        }
        catch (err) {
            setWithdrawError(err.message || 'Error withdrawing release.');
        }
        finally {
            setWithdrawLoading(false);
        }
    };
    const formatBytes = (bytes) => {
        if (!bytes || isNaN(bytes))
            return '0 MB';
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    return (_jsxs("div", { class: "space-y-8", children: [_jsxs("div", { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { class: "text-xl font-bold text-text-main", children: "APK Release & Distribution Operations" }), _jsx("p", { class: "text-xs text-text-sub mt-0.5", children: "Automatic version allocation, Android manifest extraction, and public distribution controls." })] }), _jsx("button", { onClick: () => {
                            setIsUploadOpen(true);
                            setUploadError(null);
                            setUploadSuccess(null);
                        }, class: "min-h-[44px] px-5 py-2.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0", children: _jsx("span", { children: "+ Upload New APK Release" }) })] }), analytics && (_jsxs("div", { class: "grid grid-cols-2 sm:grid-cols-4 gap-4", children: [_jsxs("div", { class: "bg-surface border border-border rounded-xl p-4 shadow-xs", children: [_jsx("span", { class: "text-xs text-text-sub block mb-1", children: "Total Downloads" }), _jsx("span", { class: "text-2xl font-black text-text-main", children: analytics.releases?.total_downloads || 0 })] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-4 shadow-xs", children: [_jsx("span", { class: "text-xs text-text-sub block mb-1", children: "Total Releases" }), _jsx("span", { class: "text-2xl font-black text-text-main", children: analytics.releases?.total_releases || 0 })] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-4 shadow-xs", children: [_jsx("span", { class: "text-xs text-text-sub block mb-1", children: "Active Published" }), _jsx("span", { class: "text-2xl font-black text-emerald-700", children: analytics.releases?.published_releases || 0 })] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-4 shadow-xs", children: [_jsx("span", { class: "text-xs text-text-sub block mb-1", children: "Draft Builds" }), _jsx("span", { class: "text-2xl font-black text-amber-700", children: analytics.releases?.draft_releases || 0 })] })] })), _jsxs("div", { class: "bg-surface border border-border rounded-xl overflow-hidden shadow-xs", children: [_jsxs("div", { class: "p-4 border-b border-border bg-slate-50 flex items-center justify-between", children: [_jsxs("h3", { class: "text-xs font-bold text-text-main uppercase tracking-wider", children: ["All Android Releases (", releases.length, ")"] }), _jsx("button", { onClick: loadData, class: "text-xs text-brand hover:underline font-semibold", children: "Refresh" })] }), loading ? (_jsx("div", { class: "py-12 text-center text-xs text-text-sub", children: "Loading releases..." })) : error ? (_jsx("div", { class: "p-4 text-xs text-danger bg-red-50", children: error })) : releases.length === 0 ? (_jsx("div", { class: "py-12 text-center text-xs text-text-sub", children: "No releases uploaded yet. Click \"Upload New APK Release\" to upload the first build." })) : (_jsx("div", { class: "overflow-x-auto", children: _jsxs("table", { class: "w-full text-left text-xs", children: [_jsx("thead", { class: "bg-slate-100 text-text-sub font-semibold border-b border-border", children: _jsxs("tr", { children: [_jsx("th", { class: "p-3.5", children: "Release" }), _jsx("th", { class: "p-3.5", children: "Android Code & Name" }), _jsx("th", { class: "p-3.5", children: "Size" }), _jsx("th", { class: "p-3.5", children: "Status" }), _jsx("th", { class: "p-3.5", children: "Downloads" }), _jsx("th", { class: "p-3.5", children: "SHA-256" }), _jsx("th", { class: "p-3.5 text-right", children: "Actions" })] }) }), _jsx("tbody", { class: "divide-y divide-border", children: releases.map((rel) => {
                                        return (_jsxs("tr", { class: "hover:bg-slate-50/80", children: [_jsx("td", { class: "p-3.5 font-bold text-text-main", children: _jsxs("div", { class: "flex items-center gap-1.5", children: [_jsx("span", { children: rel.versionDisplay }), rel.isLatest && (_jsx("span", { class: "px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800", children: "LATEST" }))] }) }), _jsxs("td", { class: "p-3.5 text-text-sub font-mono", children: ["Code ", rel.androidVersionCode, " \u2022 v", rel.versionName] }), _jsx("td", { class: "p-3.5 text-text-sub", children: formatBytes(rel.fileSize) }), _jsx("td", { class: "p-3.5", children: rel.releaseStatus === 'published' ? (_jsx("span", { class: "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800", children: "PUBLISHED" })) : rel.releaseStatus === 'draft' ? (_jsx("span", { class: "px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800", children: "DRAFT" })) : (_jsx("span", { class: "px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-danger", children: "WITHDRAWN" })) }), _jsx("td", { class: "p-3.5 font-semibold text-text-main", children: rel.downloadCount }), _jsxs("td", { class: "p-3.5 font-mono text-[11px] text-text-sub", title: rel.sha256, children: [rel.sha256.slice(0, 10), "..."] }), _jsxs("td", { class: "p-3.5 text-right space-x-2", children: [rel.releaseStatus === 'draft' && (_jsx("button", { onClick: () => handlePublish(rel), class: "px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded text-[11px] cursor-pointer", children: "Publish" })), rel.releaseStatus === 'published' && (_jsx("button", { onClick: () => {
                                                                setWithdrawTarget(rel);
                                                                setWithdrawReason('');
                                                                setWithdrawError(null);
                                                            }, class: "px-2.5 py-1 border border-red-300 text-danger hover:bg-red-50 font-semibold rounded text-[11px] cursor-pointer", children: "Withdraw" })), _jsx("a", { href: getApiUrl(`/api/beta/releases/${rel.id}/download`), download: true, class: "px-2.5 py-1 border border-border text-text-sub hover:text-text-main rounded text-[11px] inline-block", children: "Download" })] })] }, rel.id));
                                    }) })] }) }))] }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-5 shadow-xs space-y-3", children: [_jsx("h3", { class: "text-xs font-bold text-text-main uppercase tracking-wider", children: "Recent Release Audit Trail" }), auditLogs.length === 0 ? (_jsx("p", { class: "text-xs text-text-sub", children: "No recent audit records." })) : (_jsx("div", { class: "divide-y divide-border text-xs", children: auditLogs.slice(0, 10).map((log) => (_jsxs("div", { class: "py-2.5 flex items-center justify-between text-text-sub", children: [_jsxs("div", { children: [_jsx("span", { class: "font-bold text-text-main mr-2 font-mono", children: log.action }), _jsxs("span", { children: [log.entity_type, " ", log.entity_id.slice(0, 8), "..."] }), log.details && (_jsx("span", { class: "ml-2 font-mono text-[11px] text-slate-500", children: typeof log.details === 'string' ? log.details : JSON.stringify(log.details) }))] }), _jsx("div", { class: "shrink-0 text-slate-400", children: new Date(log.created_at).toLocaleString('en-IN') })] }, log.id))) }))] }), isUploadOpen && (_jsx("div", { class: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4", children: _jsxs("div", { class: "bg-surface border border-border rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5", children: [_jsxs("div", { class: "flex items-center justify-between", children: [_jsx("h3", { class: "text-base font-bold text-text-main", children: "Upload New Android APK Release" }), _jsx("button", { onClick: () => setIsUploadOpen(false), disabled: uploadLoading, class: "text-text-sub hover:text-text-main font-bold", children: "\u2715" })] }), _jsxs("p", { class: "text-xs text-text-sub leading-relaxed", children: ["The server will automatically parse the APK binary, verify the package ID (", _jsx("code", { class: "font-mono", children: "in.chandilservices.app" }), "), allocate the next release number, and compute its SHA-256 hash."] }), uploadError && (_jsxs("div", { class: "p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-xs font-medium", children: ["\u26A0\uFE0F ", uploadError] })), uploadSuccess && (_jsxs("div", { class: "p-3 rounded-lg bg-green-50 border border-green-200 text-action text-xs font-semibold", children: ["\u2713 ", uploadSuccess] })), _jsxs("form", { onSubmit: handleUploadSubmit, class: "space-y-4", children: [_jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: ["APK Binary File (.apk) ", _jsx("span", { class: "text-danger", children: "*" })] }), _jsx("input", { type: "file", required: true, accept: ".apk,application/vnd.android.package-archive", onChange: (e) => setUploadFile(e.target.files?.[0] || null), disabled: uploadLoading, class: "w-full text-xs text-text-sub file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-brand hover:file:bg-slate-200 cursor-pointer" })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: ["Release Notes / Changelog ", _jsx("span", { class: "text-danger", children: "*" })] }), _jsx("textarea", { required: true, rows: 4, placeholder: "What changed in this build? e.g. Fixed crash on Android 10, improved voice note recording clarity...", value: changelog, onInput: (e) => setChangelog(e.target.value), disabled: uploadLoading, class: "w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand leading-relaxed" })] }), _jsxs("div", { class: "flex justify-end gap-2 pt-2", children: [_jsx("button", { type: "button", onClick: () => setIsUploadOpen(false), disabled: uploadLoading, class: "px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-sub hover:bg-slate-50", children: "Cancel" }), _jsx("button", { type: "submit", disabled: uploadLoading || !uploadFile, class: "px-5 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50", children: uploadLoading ? 'Verifying APK...' : 'Upload & Validate APK' })] })] })] }) })), withdrawTarget && (_jsx("div", { class: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4", children: _jsxs("div", { class: "bg-surface border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4", children: [_jsxs("h3", { class: "text-base font-bold text-danger", children: ["Withdraw Release ", withdrawTarget.versionDisplay] }), _jsx("p", { class: "text-xs text-text-sub leading-relaxed", children: "Withdrawing a release removes it from active recommendation. Please state the reason for withdrawing this release:" }), withdrawError && (_jsx("div", { class: "p-3 rounded-lg bg-red-50 border border-red-200 text-danger text-xs", children: withdrawError })), _jsxs("form", { onSubmit: handleWithdrawConfirm, class: "space-y-4", children: [_jsx("textarea", { required: true, rows: 3, placeholder: "e.g. Critical payment gateway bug identified. Replaced by v2.", value: withdrawReason, onInput: (e) => setWithdrawReason(e.target.value), disabled: withdrawLoading, class: "w-full px-3 py-2 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand" }), _jsxs("div", { class: "flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setWithdrawTarget(null), disabled: withdrawLoading, class: "px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-sub", children: "Cancel" }), _jsx("button", { type: "submit", disabled: withdrawLoading, class: "px-5 py-2 bg-danger hover:bg-red-800 text-white font-bold text-xs rounded-lg", children: withdrawLoading ? 'Withdrawing...' : 'Confirm Withdrawal' })] })] })] }) }))] }));
}
