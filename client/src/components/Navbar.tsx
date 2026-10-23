import { currentView, navigateTo } from '../state/campus';
import { currentUser, isAuthenticated, logout } from '../state/auth';

export function Navbar() {
  const active = currentView.value;
  const user = currentUser.value;

  return (
    <header class="bg-surface border-b border-border sticky top-0 z-40 shadow-xs">
      {/* Top Desktop & Mobile Header */}
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          onClick={() => navigateTo('home')}
          class="flex items-center gap-2.5 text-left focus:outline-none group"
        >
          <div class="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center font-bold text-xl shadow-sm group-hover:bg-brand-dark transition-colors">
            🔍
          </div>
          <div>
            <div class="text-lg font-extrabold text-brand tracking-tight flex items-center gap-1.5 leading-none">
              CampusFind
              <span class="text-[10px] font-bold uppercase tracking-wider bg-brand/10 text-brand px-1.5 py-0.5 rounded">
                Campus
              </span>
            </div>
            <div class="text-[11px] text-text-sub font-medium">Lost & Found Portal</div>
          </div>
        </button>

        {/* Desktop Nav Links */}
        <nav class="hidden md:flex items-center gap-1">
          <button
            onClick={() => navigateTo('home')}
            class={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              active === 'home' ? 'bg-brand/10 text-brand' : 'text-text-sub hover:text-text-main hover:bg-slate-100'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => navigateTo('browse')}
            class={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              active === 'browse' ? 'bg-brand/10 text-brand' : 'text-text-sub hover:text-text-main hover:bg-slate-100'
            }`}
          >
            Browse Items
          </button>
          <button
            onClick={() => navigateTo('report-lost')}
            class={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              active === 'report-lost' ? 'bg-amber-100 text-amber-900' : 'text-text-sub hover:text-amber-800 hover:bg-amber-50'
            }`}
          >
            Report Lost
          </button>
          <button
            onClick={() => navigateTo('report-found')}
            class={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              active === 'report-found' ? 'bg-emerald-100 text-emerald-900' : 'text-text-sub hover:text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            Report Found
          </button>
          <button
            onClick={() => {
              if (isAuthenticated.value) {
                navigateTo('my-reports');
              } else {
                navigateTo('auth');
              }
            }}
            class={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              active === 'my-reports' ? 'bg-brand/10 text-brand' : 'text-text-sub hover:text-text-main hover:bg-slate-100'
            }`}
          >
            My Reports
          </button>
        </nav>

        {/* Auth status & user actions */}
        <div class="flex items-center gap-2">
          {isAuthenticated.value && user ? (
            <div class="flex items-center gap-2">
              <div class="hidden sm:flex flex-col text-right">
                <span class="text-xs font-bold text-text-main leading-tight">{user.fullName || 'Student'}</span>
                <span class="text-[10px] text-text-sub">{user.email || 'Verified Campus ID'}</span>
              </div>
              <button
                onClick={() => logout()}
                class="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-text-sub hover:bg-slate-100 hover:text-danger transition-colors"
                title="Log out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigateTo('auth')}
              class="px-4 py-2 text-sm font-bold bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors shadow-xs"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div class="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50 flex items-center justify-around h-16 px-1 safe-area-pb">
        <button
          onClick={() => navigateTo('home')}
          class={`flex flex-col items-center justify-center flex-1 py-1 ${
            active === 'home' ? 'text-brand font-bold' : 'text-text-sub'
          }`}
        >
          <span class="text-lg">🏠</span>
          <span class="text-[11px] mt-0.5">Home</span>
        </button>

        <button
          onClick={() => navigateTo('browse')}
          class={`flex flex-col items-center justify-center flex-1 py-1 ${
            active === 'browse' ? 'text-brand font-bold' : 'text-text-sub'
          }`}
        >
          <span class="text-lg">🔍</span>
          <span class="text-[11px] mt-0.5">Browse</span>
        </button>

        <button
          onClick={() => navigateTo('report-lost')}
          class={`flex flex-col items-center justify-center flex-1 py-1 ${
            active === 'report-lost' ? 'text-amber-700 font-bold' : 'text-text-sub'
          }`}
        >
          <span class="text-lg">📢</span>
          <span class="text-[11px] mt-0.5">Lost</span>
        </button>

        <button
          onClick={() => navigateTo('report-found')}
          class={`flex flex-col items-center justify-center flex-1 py-1 ${
            active === 'report-found' ? 'text-emerald-700 font-bold' : 'text-text-sub'
          }`}
        >
          <span class="text-lg">🎁</span>
          <span class="text-[11px] mt-0.5">Found</span>
        </button>

        <button
          onClick={() => {
            if (isAuthenticated.value) {
              navigateTo('my-reports');
            } else {
              navigateTo('auth');
            }
          }}
          class={`flex flex-col items-center justify-center flex-1 py-1 ${
            active === 'my-reports' || active === 'auth' ? 'text-brand font-bold' : 'text-text-sub'
          }`}
        >
          <span class="text-lg">{isAuthenticated.value ? '📋' : '👤'}</span>
          <span class="text-[11px] mt-0.5">{isAuthenticated.value ? 'Reports' : 'Sign In'}</span>
        </button>
      </div>
    </header>
  );
}
