import { useState } from 'preact/hooks';
import {
  studentLogin,
  studentRegister,
  authLoading,
  authError,
} from '../state/auth';
import { navigateTo, showNotification } from '../state/campus';

export function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Form states
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [studentId, setStudentId] = useState('');
  const [registerPassword, setRegisterPassword] = useState('Password123!');
  const [formValidation, setFormValidation] = useState<string | null>(null);

  // Quick Demo Login Handler
  const handleQuickDemo = async (email: string) => {
    const ok = await studentLogin(email, 'Password123!');
    if (ok) {
      showNotification(`Signed in as demo student (${email})`, 'success');
      navigateTo('home');
    }
  };

  const handleLoginSubmit = async (e: Event) => {
    e.preventDefault();
    if (!emailOrPhone.trim()) {
      setFormValidation('Please enter your email or phone.');
      return;
    }
    if (!password) {
      setFormValidation('Please enter your password.');
      return;
    }

    setFormValidation(null);
    const ok = await studentLogin(emailOrPhone.trim(), password);
    if (ok) {
      showNotification('Successfully logged in!', 'success');
      navigateTo('home');
    }
  };

  const handleRegisterSubmit = async (e: Event) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setFormValidation('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!registerEmail.trim() || !registerEmail.includes('@')) {
      setFormValidation('Please enter a valid campus email address.');
      return;
    }
    if (registerPassword.length < 6) {
      setFormValidation('Password must be at least 6 characters.');
      return;
    }

    setFormValidation(null);
    const ok = await studentRegister({
      fullName: fullName.trim(),
      email: registerEmail.trim(),
      phone: registerPhone.trim() || undefined,
      studentId: studentId.trim() || undefined,
      password: registerPassword,
    });

    if (ok) {
      showNotification('Student account created successfully!', 'success');
      navigateTo('home');
    }
  };

  return (
    <div class="max-w-md mx-auto my-8 pb-16 space-y-6">
      {/* Header */}
      <div class="text-center space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center text-2xl mx-auto shadow-sm">
          🔍
        </div>
        <h1 class="text-2xl font-extrabold text-brand tracking-tight">CampusFind Portal</h1>
        <p class="text-xs text-text-sub">
          Sign in with your university credentials or create a student profile
        </p>
      </div>

      {/* Demo Quick-Login Box */}
      <div class="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-3">
        <div class="flex items-center gap-1.5 text-xs font-bold text-blue-900">
          <span>⚡</span> Quick Demo Testing Logins (Instant 1-Click)
        </div>
        <p class="text-[11px] text-blue-800/80 leading-relaxed">
          For fast evaluation, select a pre-seeded campus account:
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickDemo('alex@campus.edu')}
            class="px-3 py-2 bg-white hover:bg-blue-100/70 border border-blue-200 rounded-xl text-left text-xs font-semibold text-blue-950 transition-colors shadow-2xs"
          >
            <div class="font-bold">Alex Chen</div>
            <div class="text-[10px] text-text-sub">alex@campus.edu</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickDemo('priya@campus.edu')}
            class="px-3 py-2 bg-white hover:bg-blue-100/70 border border-blue-200 rounded-xl text-left text-xs font-semibold text-blue-950 transition-colors shadow-2xs"
          >
            <div class="font-bold">Priya Patel</div>
            <div class="text-[10px] text-text-sub">priya@campus.edu</div>
          </button>
        </div>
      </div>

      {/* Main Auth Card */}
      <div class="bg-surface border border-border rounded-2xl p-6 shadow-xs space-y-5">
        {/* Tab Switcher */}
        <div class="flex items-center p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setFormValidation(null);
            }}
            class={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'login' ? 'bg-white text-text-main shadow-xs' : 'text-text-sub'
            }`}
          >
            Student Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setFormValidation(null);
            }}
            class={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === 'register' ? 'bg-white text-text-main shadow-xs' : 'text-text-sub'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Global Error Notice */}
        {(formValidation || authError.value) && (
          <div class="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
            {formValidation || authError.value}
          </div>
        )}

        {tab === 'login' ? (
          /* Login Form */
          <form onSubmit={handleLoginSubmit} class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-text-main mb-1">
                Campus Email or Mobile
              </label>
              <input
                type="text"
                value={emailOrPhone}
                onInput={(e) => setEmailOrPhone((e.target as HTMLInputElement).value)}
                placeholder="e.g. alex@campus.edu or 9876543211"
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                required
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text-main mb-1">Password</label>
              <input
                type="password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                placeholder="Enter password (default: Password123!)"
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                required
              />
            </div>

            <button
              type="submit"
              disabled={authLoading.value}
              class="w-full py-3 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-colors shadow-xs"
            >
              {authLoading.value ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegisterSubmit} class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-text-main mb-1">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onInput={(e) => setFullName((e.target as HTMLInputElement).value)}
                placeholder="e.g. Maya Lin"
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                required
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text-main mb-1">
                Campus Email Address *
              </label>
              <input
                type="email"
                value={registerEmail}
                onInput={(e) => setRegisterEmail((e.target as HTMLInputElement).value)}
                placeholder="e.g. maya@campus.edu"
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                required
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-text-main mb-1">Student ID #</label>
                <input
                  type="text"
                  value={studentId}
                  onInput={(e) => setStudentId((e.target as HTMLInputElement).value)}
                  placeholder="e.g. STU-2025"
                  class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-text-main mb-1">Mobile #</label>
                <input
                  type="tel"
                  value={registerPhone}
                  onInput={(e) => setRegisterPhone((e.target as HTMLInputElement).value)}
                  placeholder="e.g. 9876543219"
                  class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-text-main mb-1">Password *</label>
              <input
                type="password"
                value={registerPassword}
                onInput={(e) => setRegisterPassword((e.target as HTMLInputElement).value)}
                placeholder="At least 6 characters"
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand text-text-main"
                required
              />
            </div>

            <button
              type="submit"
              disabled={authLoading.value}
              class="w-full py-3 bg-brand text-white font-bold text-xs rounded-xl hover:bg-brand-dark transition-colors shadow-xs"
            >
              {authLoading.value ? 'Creating Account...' : 'Complete Student Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
