import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect } from 'preact/hooks';
import { isLanguageChosen, selectLanguage } from './state/language';
import { isAuthenticated, currentUser, selectedOnboardingRole } from './state/auth';
import { workerStatus, fetchWorkerStatus } from './state/worker';
import { bookingStep } from './state/booking';
import { selectedJobId } from './state/provider';
import { LoginScreen } from './components/LoginScreen';
import { CustomerHome } from './components/CustomerHome';
import { BookingForm } from './components/BookingForm';
import { BookingReview } from './components/BookingReview';
import { BookingConfirmed } from './components/BookingConfirmed';
import { BookingHistory } from './components/BookingHistory';
import { BookingDetailScreen } from './components/BookingDetailScreen';
import { ProviderHome } from './components/ProviderHome';
import { ProviderJobDetailScreen } from './components/ProviderJobDetailScreen';
import { WorkerSetupScreen } from './components/WorkerSetupScreen';
import { WorkerPendingScreen } from './components/WorkerPendingScreen';
import { WorkerRejectedScreen } from './components/WorkerRejectedScreen';
import { logout } from './state/auth';
import { t } from './state/language';
export function App() {
    // Sync worker onboarding/verification status when authenticated as customer
    useEffect(() => {
        if (isAuthenticated.value && currentUser.value?.role === 'customer') {
            fetchWorkerStatus();
        }
    }, [isAuthenticated.value, currentUser.value?.id]);
    // 1. First-launch Language Selection Screen
    // (Strict requirement: do NOT silently assume Hindi or English on fresh install)
    if (!isLanguageChosen.value) {
        return (_jsx("div", { class: "min-h-screen flex items-center justify-center p-4 bg-background", children: _jsxs("div", { class: "w-full max-w-md bg-surface border border-border rounded-lg p-6 shadow-sm", children: [_jsxs("div", { class: "text-center mb-6", children: [_jsx("h1", { class: "text-xl font-bold text-brand", children: "Chandil Home Services" }), _jsx("h2", { class: "text-lg font-semibold text-text-main mt-2", children: "Choose your language / \u092D\u093E\u0937\u093E \u091A\u0941\u0928\u0947\u0902" })] }), _jsxs("div", { class: "space-y-4", children: [_jsxs("button", { onClick: () => selectLanguage('en'), class: "w-full min-h-[56px] flex items-center justify-between px-5 py-4 border-2 border-border hover:border-brand rounded-lg text-left transition-colors bg-white focus:outline-none focus:border-brand", children: [_jsxs("div", { children: [_jsx("div", { class: "text-base font-bold text-text-main", children: "English" }), _jsx("div", { class: "text-sm text-text-sub", children: "Continue in English" })] }), _jsx("span", { class: "text-brand font-bold text-lg", children: "\u2192" })] }), _jsxs("button", { onClick: () => selectLanguage('hi'), class: "w-full min-h-[56px] flex items-center justify-between px-5 py-4 border-2 border-border hover:border-brand rounded-lg text-left transition-colors bg-white focus:outline-none focus:border-brand", children: [_jsxs("div", { children: [_jsx("div", { class: "text-base font-bold text-text-main", children: "\u0939\u093F\u0902\u0926\u0940" }), _jsx("div", { class: "text-sm text-text-sub", children: "\u0939\u093F\u0902\u0926\u0940 \u092E\u0947\u0902 \u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902" })] }), _jsx("span", { class: "text-brand font-bold text-lg", children: "\u2192" })] })] })] }) }));
    }
    // 2. Unauthenticated State -> Mobile Login Screen
    if (!isAuthenticated.value) {
        return _jsx(LoginScreen, {});
    }
    // 3. Admin Account Handling on Mobile App (Directs to Web Admin Portal)
    if (currentUser.value?.role === 'admin') {
        return (_jsx("div", { class: "min-h-screen flex items-center justify-center p-4 bg-background", children: _jsxs("div", { class: "w-full max-w-md bg-surface border border-border rounded-lg p-6 shadow-sm text-center", children: [_jsx("h2", { class: "text-lg font-bold text-brand mb-2", children: "Admin Account Detected" }), _jsx("p", { class: "text-sm text-text-sub mb-6", children: "This application is for customers and service providers. Please use the Admin Web Portal on a browser at /admin to manage operations." }), _jsx("button", { onClick: () => logout(), class: "w-full min-h-[48px] px-4 py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand-dark transition-colors", children: t('auth.logout') })] }) }));
    }
    // 4. Provider Role Flow
    if (currentUser.value?.role === 'provider') {
        if (selectedJobId.value) {
            return _jsx(ProviderJobDetailScreen, {});
        }
        return _jsx(ProviderHome, {});
    }
    // 5. Worker Onboarding State Handling
    if (workerStatus.value === 'PENDING_VERIFICATION') {
        return _jsx(WorkerPendingScreen, {});
    }
    if (workerStatus.value === 'REJECTED') {
        return _jsx(WorkerRejectedScreen, {});
    }
    if (selectedOnboardingRole.value === 'worker' && workerStatus.value !== 'VERIFIED') {
        return _jsx(WorkerSetupScreen, {});
    }
    // 6. Customer Role Flow (Customer App)
    switch (bookingStep.value) {
        case 'details':
            return _jsx(BookingForm, {});
        case 'review':
            return _jsx(BookingReview, {});
        case 'confirmed':
            return _jsx(BookingConfirmed, {});
        case 'history':
            return _jsx(BookingHistory, {});
        case 'status':
            return _jsx(BookingDetailScreen, {});
        case 'home':
        default:
            return _jsx(CustomerHome, {});
    }
}
