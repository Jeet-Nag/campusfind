import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useState } from 'preact/hooks';
import { latestRelease, isSubmitting, submissionError, submissionSuccess, submitBetaFeedback, navigateBeta, } from '../state/beta';
import { t } from '../state/language';
export function BetaSubmitFeedbackModal() {
    const currentRel = latestRelease.value;
    const submitting = isSubmitting.value;
    const error = submissionError.value;
    const success = submissionSuccess.value;
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('BUG_REPORT');
    const [appVersion, setAppVersion] = useState(currentRel?.versionDisplay || 'v1');
    const [testerRole, setTesterRole] = useState('customer');
    const [deviceModel, setDeviceModel] = useState('');
    const [androidVersion, setAndroidVersion] = useState('');
    const [authorName, setAuthorName] = useState('');
    const [screenshotBase64, setScreenshotBase64] = useState(undefined);
    const [screenshotMime, setScreenshotMime] = useState(undefined);
    const [screenshotPreview, setScreenshotPreview] = useState(null);
    const [localError, setLocalError] = useState(null);
    const handleScreenshotChange = (e) => {
        setLocalError(null);
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            setLocalError('Only image files (PNG, JPEG, WebP) are accepted.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setLocalError('Image file must not exceed 5 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            setScreenshotBase64(result);
            setScreenshotMime(file.type);
            setScreenshotPreview(result);
        };
        reader.readAsDataURL(file);
    };
    const handleRemoveScreenshot = () => {
        setScreenshotBase64(undefined);
        setScreenshotMime(undefined);
        setScreenshotPreview(null);
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError(null);
        if (!title.trim() || title.trim().length < 3) {
            setLocalError('Please enter a descriptive title (at least 3 characters).');
            return;
        }
        if (!description.trim() || description.trim().length < 5) {
            setLocalError('Please enter a description explaining what happened (at least 5 characters).');
            return;
        }
        if (!authorName.trim()) {
            setLocalError('Please enter your name.');
            return;
        }
        const ok = await submitBetaFeedback({
            title: title.trim(),
            description: description.trim(),
            category,
            appVersion,
            testerRole,
            deviceModel: deviceModel.trim() || undefined,
            androidVersion: androidVersion.trim() || undefined,
            authorName: authorName.trim(),
            screenshotBase64,
            screenshotMime,
        });
        if (ok) {
            setTimeout(() => {
                navigateBeta('feedback');
            }, 1500);
        }
    };
    return (_jsxs("div", { class: "max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6", children: [_jsx("div", { class: "flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider", children: _jsx("button", { onClick: () => navigateBeta('feedback'), class: "hover:text-brand cursor-pointer", children: "\u2190 Back to Feedback Board" }) }), _jsxs("div", { class: "bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { class: "text-2xl font-bold text-text-main", children: t('beta.submit_feedback_title') }), _jsx("p", { class: "text-xs text-text-sub mt-1", children: "Report issues, UI glitches, or suggest improvements to help the Chandil team polish the app." })] }), success && (_jsxs("div", { class: "p-4 rounded-lg bg-green-50 border border-green-200 text-action text-xs font-semibold flex items-center gap-2", children: [_jsx("span", { children: "\u2713" }), _jsx("span", { children: t('beta.form_success') })] })), (localError || error) && (_jsxs("div", { class: "p-4 rounded-lg bg-red-50 border border-red-200 text-danger text-xs font-medium flex items-center gap-2", children: [_jsx("span", { children: "\u26A0\uFE0F" }), _jsx("span", { children: localError || error })] })), _jsxs("form", { onSubmit: handleSubmit, class: "space-y-5", children: [_jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: [t('beta.form_title'), " ", _jsx("span", { class: "text-danger", children: "*" })] }), _jsx("input", { type: "text", required: true, placeholder: t('beta.form_title_placeholder'), value: title, onInput: (e) => setTitle(e.target.value), disabled: submitting, class: "w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand" })] }), _jsxs("div", { class: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('beta.form_category') }), _jsxs("select", { value: category, onChange: (e) => setCategory(e.target.value), disabled: submitting, class: "w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand", children: [_jsx("option", { value: "BUG_REPORT", children: "Bug Report" }), _jsx("option", { value: "UI_DESIGN", children: "UI / Design Polish" }), _jsx("option", { value: "PERFORMANCE", children: "Performance & Slowness" }), _jsx("option", { value: "AUTH", children: "Login & Authentication" }), _jsx("option", { value: "BOOKING", children: "Booking Flow" }), _jsx("option", { value: "WORKER_EXPERIENCE", children: "Worker Experience" }), _jsx("option", { value: "FEATURE_REQUEST", children: "Feature Request" }), _jsx("option", { value: "OTHER", children: "Other" })] })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('beta.form_app_version') }), _jsx("input", { type: "text", value: appVersion, onInput: (e) => setAppVersion(e.target.value), disabled: submitting, placeholder: "e.g. v1", class: "w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand" })] })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: [t('beta.form_desc'), " ", _jsx("span", { class: "text-danger", children: "*" })] }), _jsx("textarea", { required: true, rows: 5, placeholder: t('beta.form_desc_placeholder'), value: description, onInput: (e) => setDescription(e.target.value), disabled: submitting, class: "w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand leading-relaxed" })] }), _jsxs("div", { class: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('beta.form_role') }), _jsxs("select", { value: testerRole, onChange: (e) => setTesterRole(e.target.value), disabled: submitting, class: "w-full px-3 py-2.5 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand font-semibold", children: [_jsx("option", { value: "customer", children: t('beta.form_role_customer') }), _jsx("option", { value: "worker", children: t('beta.form_role_worker') }), _jsx("option", { value: "both", children: t('beta.form_role_both') })] })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('beta.form_device') }), _jsx("input", { type: "text", placeholder: "e.g. Redmi 9A", value: deviceModel, onInput: (e) => setDeviceModel(e.target.value), disabled: submitting, class: "w-full px-3 py-2.5 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand" })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('beta.form_android_ver') }), _jsx("input", { type: "text", placeholder: "e.g. Android 11", value: androidVersion, onInput: (e) => setAndroidVersion(e.target.value), disabled: submitting, class: "w-full px-3 py-2.5 bg-white border border-border rounded-lg text-xs text-text-main focus:outline-none focus:border-brand" })] })] }), _jsxs("div", { children: [_jsxs("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: [t('beta.form_name'), " ", _jsx("span", { class: "text-danger", children: "*" })] }), _jsx("input", { type: "text", required: true, placeholder: "e.g. Rahul Kumar", value: authorName, onInput: (e) => setAuthorName(e.target.value), disabled: submitting, class: "w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-brand" })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5", children: t('beta.form_screenshot') }), screenshotPreview ? (_jsxs("div", { class: "flex items-center gap-4 p-3 bg-slate-50 border border-border rounded-lg", children: [_jsx("img", { src: screenshotPreview, alt: "Attachment preview", class: "w-16 h-16 object-cover rounded border border-border" }), _jsxs("div", { class: "flex-1 text-xs text-text-sub", children: [_jsx("span", { class: "font-medium text-text-main block", children: "Image attached" }), _jsx("span", { class: "text-[11px]", children: "Ready for upload" })] }), _jsx("button", { type: "button", onClick: handleRemoveScreenshot, class: "text-xs text-danger hover:underline font-semibold", children: "Remove" })] })) : (_jsx("input", { type: "file", accept: "image/png,image/jpeg,image/webp", onChange: handleScreenshotChange, disabled: submitting, class: "w-full text-xs text-text-sub file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-brand hover:file:bg-slate-200 cursor-pointer" }))] }), _jsxs("div", { class: "pt-4 flex items-center justify-end gap-3 border-t border-border", children: [_jsx("button", { type: "button", onClick: () => navigateBeta('feedback'), disabled: submitting, class: "min-h-[44px] px-4 py-2 border border-border rounded-lg text-xs font-semibold text-text-sub hover:bg-slate-50", children: "Cancel" }), _jsx("button", { type: "submit", disabled: submitting, class: "min-h-[44px] px-6 py-2.5 bg-brand hover:bg-brand-dark active:bg-slate-900 text-white font-bold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50", children: submitting ? (_jsxs(_Fragment, { children: [_jsx("div", { class: "w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" }), _jsx("span", { children: t('beta.form_submitting') })] })) : (_jsx("span", { children: t('beta.form_submit_btn') })) })] })] })] })] }));
}
