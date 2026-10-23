import { useEffect } from 'preact/hooks';
import {
  currentView,
  selectedItemId,
  globalNotification,
  navigateTo,
  fetchCampusItems,
} from './state/campus';
import { authToken, currentUser, isAuthenticated } from './state/auth';
import { Navbar } from './components/Navbar';
import { HomeScreen } from './components/HomeScreen';
import { BrowseScreen } from './components/BrowseScreen';
import { ReportFormScreen } from './components/ReportFormScreen';
import { ItemDetailScreen } from './components/ItemDetailScreen';
import { MyReportsScreen } from './components/MyReportsScreen';
import { AuthScreen } from './components/AuthScreen';

export function App() {
  // Sync URL route on initial load and handle browser back/forward
  useEffect(() => {
    // Initial data fetch
    fetchCampusItems();

    // Verify authenticated session against /api/auth/me if token exists
    if (authToken.value) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken.value}` },
      })
        .then(async (res) => {
          if (res.status === 401) {
            authToken.value = null;
            currentUser.value = null;
            return;
          }
          const data = await res.json();
          if (data.success && data.data?.user) {
            currentUser.value = data.data.user;
          }
        })
        .catch(() => {});
    }

    // Parse initial URL
    const pathname = window.location.pathname;
    if (pathname.startsWith('/item/')) {
      const id = pathname.replace('/item/', '');
      navigateTo('item-detail', id);
    } else if (pathname === '/browse') {
      currentView.value = 'browse';
    } else if (pathname === '/report-lost') {
      currentView.value = 'report-lost';
    } else if (pathname === '/report-found') {
      currentView.value = 'report-found';
    } else if (pathname === '/my-reports') {
      currentView.value = 'my-reports';
    } else if (pathname === '/auth') {
      currentView.value = 'auth';
    } else {
      currentView.value = 'home';
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.view) {
        currentView.value = e.state.view;
        selectedItemId.value = e.state.itemId || null;
      } else {
        const path = window.location.pathname;
        if (path.startsWith('/item/')) {
          selectedItemId.value = path.replace('/item/', '');
          currentView.value = 'item-detail';
        } else if (path === '/browse') {
          currentView.value = 'browse';
        } else if (path === '/report-lost') {
          currentView.value = 'report-lost';
        } else if (path === '/report-found') {
          currentView.value = 'report-found';
        } else if (path === '/my-reports') {
          currentView.value = 'my-reports';
        } else if (path === '/auth') {
          currentView.value = 'auth';
        } else {
          currentView.value = 'home';
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div class="min-h-screen flex flex-col bg-background text-text-main font-sans antialiased">
      {/* Global Navigation Bar */}
      <Navbar />

      {/* Global Toast Notification */}
      {globalNotification.value && (
        <div class="fixed top-20 right-4 z-50 max-w-sm w-full animate-fade-in pointer-events-none">
          <div
            class={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center justify-between gap-3 ${
              globalNotification.value.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : globalNotification.value.type === 'error'
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-brand text-white border-brand-dark'
            }`}
          >
            <span>
              {globalNotification.value.type === 'success'
                ? '✓ '
                : globalNotification.value.type === 'error'
                ? '⚠️ '
                : 'ℹ️ '}
              {globalNotification.value.message}
            </span>
            <button
              onClick={() => (globalNotification.value = null)}
              class="text-white/80 hover:text-white font-bold ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 pb-20 md:pb-12">
        {currentView.value === 'home' && <HomeScreen />}
        {currentView.value === 'browse' && <BrowseScreen />}
        {currentView.value === 'report-lost' && <ReportFormScreen initialType="lost" />}
        {currentView.value === 'report-found' && <ReportFormScreen initialType="found" />}
        {currentView.value === 'item-detail' && selectedItemId.value && (
          <ItemDetailScreen itemId={selectedItemId.value} />
        )}
        {currentView.value === 'my-reports' && <MyReportsScreen />}
        {currentView.value === 'auth' && <AuthScreen />}
      </main>

      {/* Desktop & Tablet Footer */}
      <footer class="hidden md:block bg-surface border-t border-border mt-auto py-8">
        <div class="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-sub">
          <div class="flex items-center gap-2">
            <span class="font-bold text-brand">CampusFind</span>
            <span>•</span>
            <span>University Lost & Found Safe Verification Network</span>
          </div>
          <div>
            <span>All student reports are securely stored and verified.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
