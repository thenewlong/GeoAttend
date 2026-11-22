import React, { useState } from 'react';
import { apiRequest, setToken } from '../api/client';

export default function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('employee'); // 'employee' | 'admin'
  const [identifier, setIdentifier] = useState('employee@geoattend.demo');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setInfoMsg('');
    setIdentifier(nextMode === 'admin' ? 'admin@geoattend.demo' : 'employee@geoattend.demo');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!identifier.trim() || !password) {
      setError('Email/ID aur password dono zaroori hain.');
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        auth: false,
        body: {
          identifier: identifier.trim(),
          password,
        },
      });

      if (mode === 'admin' && data.user.role !== 'admin') {
        setError('Yeh account administrator nahi hai.');
        return;
      }
      if (mode === 'employee' && data.user.role === 'admin') {
        setError('Administrator login ke liye Administrator access select karein.');
        return;
      }

      if (rememberMe) {
        setToken(data.token);
        localStorage.setItem('ga_user', JSON.stringify(data.user));
      } else {
        setToken(null);
        localStorage.removeItem('ga_user');
        sessionStorage.setItem('ga_token_temp', data.token);
      }

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F3] text-[#191D19] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md bg-white border-2 border-[#191D19] rounded-2xl p-6 sm:p-7 shadow-[6px_6px_0_#191D19] space-y-5">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#191D19]">
            {mode === 'admin' ? 'Administrator sign in' : 'Employee sign in'}
          </h2>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[#FFD84D]/40 border-2 border-[#191D19] text-[#191D19] text-xs font-bold">
            {error}
          </div>
        )}

        {infoMsg && (
          <div className="p-3 rounded-xl bg-[#E8EFE4] border-2 border-[#191D19] text-[#191D19] text-xs font-semibold">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identifier Field */}
          <div>
            <label className="block text-sm font-bold text-[#191D19] mb-1.5">
              {mode === 'admin' ? 'Admin ID or email' : 'Employee ID or email'}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={mode === 'admin' ? 'admin@geoattend.demo' : 'employee@geoattend.demo'}
              className="w-full bg-white border-2 border-[#191D19] rounded-xl px-4 py-3 text-base font-medium text-[#191D19] placeholder:text-[#8A9188] focus:outline-none focus:shadow-[3px_3px_0_#191D19] transition-all"
            />
          </div>

          {/* Password Field + Show Toggle Button */}
          <div>
            <label className="block text-sm font-bold text-[#191D19] mb-1.5">
              Password
            </label>
            <div className="flex items-stretch gap-2.5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="flex-1 min-w-0 bg-white border-2 border-[#191D19] rounded-xl px-4 py-3 text-base font-medium text-[#191D19] placeholder:text-[#8A9188] focus:outline-none focus:shadow-[3px_3px_0_#191D19] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="px-4 bg-white hover:bg-[#F8F8F3] text-[#191D19] font-bold text-sm rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer shrink-0"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <label className="flex items-center gap-2.5 pt-0.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 accent-[#6B8A63] border-2 border-[#191D19] rounded cursor-pointer"
            />
            <span className="text-sm font-medium text-[#191D19]">
              Keep me signed in on this device
            </span>
          </label>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#6B8A63] hover:bg-[#5E7B56] disabled:opacity-60 text-white font-bold text-base px-6 py-2.5 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                setInfoMsg('Password reset ke liye apne NIELIT GeoAttend Administrator se sampark karein.');
              }}
              className="bg-white hover:bg-[#F8F8F3] text-[#191D19] font-bold text-base px-5 py-2.5 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
            >
              Forgot password
            </button>
          </div>
        </form>

        {/* Footer Demo & Mode Switcher */}
        <div className="pt-3 border-t border-[#E8EFE4] space-y-2 text-sm text-[#6E756C]">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>Demo account:</span>
            <span className="font-bold text-[#4A5049]">
              {mode === 'admin' ? 'admin@geoattend.demo' : 'employee@geoattend.demo'}
            </span>
            <span>·</span>
            {mode === 'employee' ? (
              <button
                type="button"
                onClick={() => switchMode('admin')}
                className="text-[#1D4ED8] underline font-medium cursor-pointer"
              >
                Administrator access
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('employee')}
                className="text-[#1D4ED8] underline font-medium cursor-pointer"
              >
                Employee access
              </button>
            )}
          </div>

          <p className="text-xs leading-relaxed text-[#7A8178]">
            Authenticated via PostgreSQL &amp; JWT backend. Active session stays saved on your device.
          </p>
        </div>
      </div>
    </div>
  );
}