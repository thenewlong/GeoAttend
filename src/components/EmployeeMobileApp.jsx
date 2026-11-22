import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client';
import Attendance from './Attendance';

export default function EmployeeMobileApp({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'history' | 'profile' | 'mark'
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/attendance/dashboard');
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const now = new Date();
  const hr = now.getHours();
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.name || 'Employee').split(' ')[0];
  const formattedDate = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const policy = dashboard?.policy || {
    window_start: '09:30',
    window_end: '10:30',
    radius_meters: 150,
  };
  const todayRecord = dashboard?.todayRecord || null;
  const records = dashboard?.records || [];

  const formatTime12 = (hhmm) => {
    if (!hhmm) return '';
    const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="min-h-screen bg-[#F8F8F3] text-[#191D19] pb-24">
      {/* Mobile Header (Matches Reference Screenshot) */}
      <header className="sticky top-0 z-20 bg-[#F8F8F3] border-b-2 border-[#191D19] px-5 py-3.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#6B8A63] border-2 border-[#191D19] flex items-center justify-center text-white text-xl shadow-[2px_2px_0_#191D19]">
              📍
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-tight leading-none">GeoAttend</div>
              <div className="text-[11px] font-bold tracking-widest text-[#5E645D] uppercase mt-1">
                NIELIT AGARTALA
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
              className="w-11 h-11 rounded-xl bg-white border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] flex flex-col items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="w-5 h-0.5 bg-[#191D19] block"></span>
              <span className="w-5 h-0.5 bg-[#191D19] block"></span>
              <span className="w-5 h-0.5 bg-[#191D19] block"></span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border-2 border-[#191D19] rounded-xl shadow-[4px_4px_0_#191D19] p-1.5 z-30">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setActiveTab('profile');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-[#E8EFE4] cursor-pointer"
                >
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-bold text-[#E4572E] rounded-lg hover:bg-red-50 cursor-pointer"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-md mx-auto px-5 pt-6 space-y-6">
        {/* MARK ATTENDANCE SCREEN */}
        {activeTab === 'mark' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="bg-white border-2 border-[#191D19] rounded-xl px-4 py-2 text-xs font-bold shadow-[3px_3px_0_#191D19] cursor-pointer"
            >
              ← Back to Dashboard
            </button>
            <Attendance
              onSuccess={() => {
                loadDashboard();
                setActiveTab('home');
              }}
            />
          </div>
        )}

        {/* HOME TAB (EXACT SCREENSHOT LAYOUT) */}
        {activeTab === 'home' && (
          <>
            {/* Greeting */}
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
                {greeting}, <span className="text-[#6B8A63]">{firstName}</span>
              </h1>
              <p className="text-base text-[#3D423C] mt-1 font-medium">
                Your campus attendance
              </p>
            </div>

            {/* Main Status Card */}
            <div className="bg-white border-2 border-[#191D19] rounded-2xl p-6 shadow-[5px_5px_0_#191D19] flex items-center gap-5">
              <div
                className={`w-16 h-16 shrink-0 rounded-full border-2 border-[#191D19] flex items-center justify-center text-3xl font-extrabold ${
                  todayRecord ? 'bg-[#6B8A63] text-white' : 'bg-[#FFD84D] text-[#191D19]'
                }`}
              >
                {todayRecord ? '✓' : '!'}
              </div>
              <div>
                <h2 className="text-2xl font-extrabold leading-tight">
                  {todayRecord ? "You're checked in" : "You're not checked in"}
                </h2>
                <p className="text-sm font-medium text-[#4A5049] mt-1.5 flex items-center gap-1.5">
                  <span>📍</span>
                  <span>
                    {todayRecord
                      ? `Verified at ${formatTime12(todayRecord.check_in_time)} (${todayRecord.distance_meters}m)`
                      : 'Campus location'}
                  </span>
                </p>
              </div>
            </div>

            {/* Primary & Secondary Action Buttons */}
            <div className="space-y-3.5">
              {!todayRecord && (
                <button
                  type="button"
                  onClick={() => setActiveTab('mark')}
                  className="w-full bg-[#6B8A63] text-white font-bold text-lg py-4 rounded-2xl border-2 border-[#191D19] shadow-[4px_4px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span className="text-xl">📷</span>
                  <span>Mark Attendance</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="w-full bg-white text-[#191D19] font-bold text-lg py-3.5 rounded-2xl border-2 border-[#191D19] shadow-[4px_4px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span>🕒</span>
                <span>View History</span>
              </button>
            </div>

            {/* Today's Rules */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold tracking-tight">Today&apos;s rules</h3>
                <span className="bg-[#E8EFE4] border-2 border-[#191D19] rounded-xl px-3 py-1 text-xs font-bold flex items-center gap-1.5">
                  <span>📅</span>
                  <span>{formattedDate}</span>
                </span>
              </div>

              <div className="bg-white border-2 border-[#191D19] rounded-2xl p-4 grid grid-cols-3 divide-x-2 divide-[#E8EFE4]">
                <div className="pr-2">
                  <div className="text-[11px] font-semibold text-[#5E645D] flex items-center gap-1">
                    <span>🕒</span> Check-in Window
                  </div>
                  <div className="font-extrabold text-xs mt-1.5 leading-snug">
                    {formatTime12(policy.window_start)} –<br />
                    {formatTime12(policy.window_end)}
                  </div>
                </div>

                <div className="px-2.5">
                  <div className="text-[11px] font-semibold text-[#5E645D] flex items-center gap-1">
                    <span>📍</span> Campus Geofence
                  </div>
                  <div className="font-extrabold text-sm mt-1.5">
                    {policy.radius_meters} m
                  </div>
                </div>

                <div className="pl-2.5">
                  <div className="text-[11px] font-semibold text-[#5E645D] flex items-center gap-1">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        todayRecord ? 'bg-[#6B8A63]' : 'bg-[#FFD84D]'
                      }`}
                    ></span>
                    Status
                  </div>
                  <div className="font-extrabold text-sm mt-1.5">
                    {todayRecord ? 'Present' : 'Not marked'}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-extrabold tracking-tight">Recent activity</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-sm font-bold text-[#6B8A63] cursor-pointer"
                >
                  See all →
                </button>
              </div>

              {loading ? (
                <div className="bg-white border-2 border-[#191D19] rounded-2xl p-4 text-xs font-semibold text-[#5E645D]">
                  Loading activity...
                </div>
              ) : (
                <div className="space-y-3">
                  {!todayRecord && (
                    <div
                      onClick={() => setActiveTab('mark')}
                      className="bg-white border-2 border-[#191D19] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-[#E8EFE4]/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#FFD84D] border border-[#191D19]"></span>
                        <div>
                          <div className="font-bold text-sm">Attendance not marked</div>
                          <div className="text-xs text-[#5E645D] mt-0.5">
                            Today • {currentTime}
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-lg">›</span>
                    </div>
                  )}

                  {records.slice(0, 3).map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => setActiveTab('history')}
                      className="bg-white border-2 border-[#191D19] rounded-2xl p-4 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#6B8A63] border border-[#191D19]"></span>
                        <div>
                          <div className="font-bold text-sm">
                            {String(rec.attendance_date).slice(0, 10) ===
                            now.toISOString().slice(0, 10)
                              ? 'Checked in today'
                              : `Check-in (${String(rec.attendance_date).slice(0, 10)})`}
                          </div>
                          <div className="text-xs text-[#5E645D] mt-0.5">
                            {formatTime12(rec.check_in_time)} • {rec.distance_meters}m
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-lg">›</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Privacy Bar */}
              <div className="bg-white border-2 border-[#191D19] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#3D423C] flex items-center justify-center gap-2">
                <span className="bg-[#6B8A63] text-white rounded px-1.5 py-0.5 text-[10px]">
                  🔒
                </span>
                <span>Location is checked only when you mark attendance.</span>
              </div>
            </div>
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold">Attendance History</h2>
            {records.length === 0 ? (
              <div className="bg-white border-2 border-[#191D19] rounded-2xl p-6 text-sm font-medium text-[#5E645D]">
                Abhi koi attendance record nahi hai.
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white border-2 border-[#191D19] rounded-2xl p-4 shadow-[4px_4px_0_#191D19] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-extrabold text-sm">
                        {String(r.attendance_date).slice(0, 10)}
                      </div>
                      <div className="text-xs text-[#5E645D] mt-0.5">
                        {formatTime12(r.check_in_time)} • {r.distance_meters}m • Ref: {r.ref_code}
                      </div>
                      <span className="inline-block mt-2 bg-[#6B8A63] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-[#191D19]">
                        {r.status}
                      </span>
                    </div>
                    {r.selfie_url && (
                      <img
                        src={r.selfie_url}
                        alt="Selfie"
                        className="w-16 h-14 object-cover rounded-xl border-2 border-[#191D19]"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold">My Profile</h2>
            <div className="bg-white border-2 border-[#191D19] rounded-2xl p-6 shadow-[5px_5px_0_#191D19] space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#FFD84D] border-2 border-[#191D19] flex items-center justify-center text-2xl font-extrabold">
                {(user?.name || 'E')[0]}
              </div>
              <div>
                <div className="text-xl font-extrabold">{user?.name}</div>
                <div className="text-xs font-bold text-[#5E645D] mt-0.5">
                  {user?.id} • {user?.dept} • {user?.designation}
                </div>
                <div className="text-xs text-[#5E645D] mt-1">{user?.email}</div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="w-full bg-[#E4572E] text-white font-bold text-sm py-3 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation (Home | History | Profile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-[#191D19]">
        <div className="max-w-md mx-auto grid grid-cols-3 divide-x-2 divide-[#E8EFE4]">
          {[
            { id: 'home', label: 'Home', icon: '🏠' },
            { id: 'history', label: 'History', icon: '🕒' },
            { id: 'profile', label: 'Profile', icon: '👤' },
          ].map((item) => {
            const active = activeTab === item.id || (item.id === 'home' && activeTab === 'mark');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-3 flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  active ? 'text-[#6B8A63] font-extrabold' : 'text-[#191D19] font-semibold'
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}