import React, { useState } from 'react';
import { AnimatedLogo } from '../shared/AnimatedLogo';

interface AuthScreenProps {
  hasUsers: boolean;
  registrationAllowed: boolean;
  onLogin: (username: string, password: string) => Promise<boolean>;
  onRegister: (username: string, password: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

export function AuthScreen({
  hasUsers,
  registrationAllowed,
  onLogin,
  onRegister,
  isLoading,
  error,
  onClearError,
}: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Allow user to toggle to registration when multi-user mode is enabled
  const [showRegister, setShowRegister] = useState(false);

  // Force back to login mode if registration becomes disabled
  React.useEffect(() => {
    if (!registrationAllowed && hasUsers) {
      setShowRegister(false);
    }
  }, [registrationAllowed, hasUsers]);

  // First user registration (mandatory) OR user chose to register in multi-user mode
  const isRegisterMode = (!hasUsers && registrationAllowed) || (hasUsers && registrationAllowed && showRegister);
  const canShowRegisterToggle = hasUsers && registrationAllowed;
  const isFirstUser = !hasUsers;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();

    // Validation
    if (username.length < 3 || username.length > 32) {
      setLocalError('Username must be between 3 and 32 characters');
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      setLocalError('Username can only contain letters, numbers, dots, underscores, and hyphens');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    if (isRegisterMode) {
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
      await onRegister(username, password);
    } else {
      await onLogin(username, password);
    }
  };

  const toggleMode = () => {
    setShowRegister(!showRegister);
    setLocalError(null);
    onClearError();
    setPassword('');
    setConfirmPassword('');
  };

  const displayError = error || localError;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <AnimatedLogo scale={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-100 tracking-tight">HomeBank Bridge</h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">
            {isFirstUser 
              ? 'Create Administrator Account' 
              : isRegisterMode 
                ? 'Create New Account' 
                : 'Sign in to continue'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="admin"
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="********"
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              />
            </div>

            {/* Confirm Password (Register mode only) */}
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                  placeholder="********"
                  autoComplete="new-password"
                />
              </div>
            )}

            {/* Error Message */}
            {displayError && (
              <div className="p-4 bg-[#FEF3F2] border border-[#FECDCA] rounded-xl">
                <p className="text-rose-400 text-sm font-medium">{displayError}</p>
              </div>
            )}

            {/* Registration disabled message (only when single-admin mode) */}
            {hasUsers && !registrationAllowed && (
              <div className="p-4 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl">
                <p className="text-amber-400 text-sm font-medium">
                  Registration is disabled. Contact the administrator.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isRegisterMode ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                isRegisterMode ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {/* Info for first user */}
          {isFirstUser && (
            <p className="mt-6 text-center text-xs text-slate-500">
              The first user automatically receives administrator privileges.
            </p>
          )}

          {/* Toggle between login/register when multi-user is enabled */}
          {canShowRegisterToggle && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={toggleMode}
                disabled={isLoading}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors disabled:opacity-50"
              >
                {showRegister 
                  ? 'Already have an account? Sign in' 
                  : 'Need an account? Register'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
