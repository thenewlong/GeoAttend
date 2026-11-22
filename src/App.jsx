import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import EmployeeMobileApp from './components/EmployeeMobileApp';
import AdminDashboard from './components/AdminDashboard';
import { apiRequest, getToken, setToken } from './api/client';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ga_user') || 'null');
    } catch {
      return null;
    }
  });
  const [checkingSession, setCheckingSession] = useState(Boolean(getToken()));
  const [showLogin, setShowLogin] = useState(false);

  // Verify saved token on app reopen so user doesn't have to login repeatedly
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }

    apiRequest('/auth/me')
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem('ga_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem('ga_user');
        setUser(null);
      })
      .finally(() => {
        setCheckingSession(false);
      });
  }, []);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('ga_user');
    setUser(null);
    setShowLogin(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#F8F8F3] flex items-center justify-center font-bold text-[#191D19]">
        Loading GeoAttend...
      </div>
    );
  }

  // Logged-in state: Direct dashboard (no repeat login)
  if (user) {
    if (user.role === 'admin') {
      return (
        <div className="min-h-screen bg-[#F8F8F3]">
          <header className="bg-white border-b-2 border-[#191D19] px-6 py-3.5 flex items-center justify-between">
            <div className="font-extrabold text-[#191D19]">
              NIELIT GeoAttend <span className="text-xs ml-2 px-2 py-0.5 rounded bg-[#FFD84D] border border-[#191D19]">Admin</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl border-2 border-[#191D19] text-xs font-bold bg-white shadow-[2px_2px_0_#191D19] cursor-pointer"
            >
              Logout
            </button>
          </header>
          <AdminDashboard />
        </div>
      );
    }

    return <EmployeeMobileApp user={user} onLogout={handleLogout} />;
  }

  // Logged-out state: Show Landing Page first, then Login on click
  if (showLogin) {
    return (
      <div className="min-h-screen bg-[#F8F8F3] px-4 pt-6">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setShowLogin(false)}
            className="bg-white border-2 border-[#191D19] rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-[3px_3px_0_#191D19] cursor-pointer"
          >
            ← Back to Home
          </button>
        </div>
        <Login
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            setShowLogin(false);
          }}
        />
      </div>
    );
  }

  return <LandingPage onOpenLogin={() => setShowLogin(true)} />;
}