import React from 'react';

export default function LandingPage({ onOpenLogin }) {
  const steps = [
    {
      num: '01',
      title: 'Sign In Once',
      desc: 'Log in with your Employee ID or email. Your session stays active on your phone.',
      bg: 'bg-[#FFD84D]',
    },
    {
      num: '02',
      title: 'Verify Campus Location',
      desc: 'GPS checks once that you are inside the NIELIT Agartala geofence radius.',
      bg: 'bg-[#E8EFE4]',
    },
    {
      num: '03',
      title: 'Capture Live Selfie',
      desc: 'Take a fresh front-camera selfie during the permitted check-in window.',
      bg: 'bg-[#6B8A63] text-white',
    },
    {
      num: '04',
      title: 'Instant Confirmation',
      desc: 'Attendance is securely recorded in PostgreSQL with your reference code.',
      bg: 'bg-white',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F8F3] text-[#191D19] pb-16">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 bg-[#F8F8F3] border-b-2 border-[#191D19] px-5 py-3.5 flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#6B8A63] border-2 border-[#191D19] flex items-center justify-center text-white font-bold">
            ⌖
          </div>
          <div>
            <div className="font-bold text-base leading-none">GeoAttend</div>
            <div className="text-[10px] font-semibold tracking-wider text-[#727970] uppercase mt-0.5">
              NIELIT Agartala
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenLogin}
          className="bg-[#FFD84D] text-[#191D19] font-bold text-xs px-4 py-2 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
        >
          Sign In
        </button>
      </header>

      <main className="max-w-md mx-auto px-5 pt-7 space-y-6">
        {/* Hero Card */}
        <div className="bg-white border-2 border-[#191D19] rounded-2xl p-6 shadow-[5px_5px_0_#191D19] space-y-4">
          <span className="inline-block bg-[#E8EFE4] border-2 border-[#191D19] rounded-lg px-2.5 py-1 text-xs font-bold">
            ● Smart Campus Attendance
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
            Attendance you can <span className="text-[#6B8A63] underline">verify.</span>
          </h1>
          <p className="text-sm text-[#4A5049] leading-relaxed">
            Built for NIELIT Agartala employees. Check in seamlessly using campus geofencing, time-window policies, and live selfie verification.
          </p>
          <button
            type="button"
            onClick={onOpenLogin}
            className="w-full bg-[#6B8A63] text-white font-bold text-sm py-3.5 rounded-xl border-2 border-[#191D19] shadow-[4px_4px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
          >
            Employee / Admin Login →
          </button>
        </div>

        {/* How It Works */}
        <div className="space-y-3">
          <h2 className="text-lg font-extrabold tracking-tight">How GeoAttend Works</h2>
          <div className="space-y-3">
            {steps.map((s) => (
              <div
                key={s.num}
                className={`${s.bg} border-2 border-[#191D19] rounded-2xl p-4 shadow-[4px_4px_0_#191D19] flex gap-3.5 items-start`}
              >
                <div className="font-extrabold text-xl leading-none pt-0.5">{s.num}</div>
                <div>
                  <h3 className="font-bold text-sm">{s.title}</h3>
                  <p className="text-xs opacity-90 mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Note */}
        <div className="bg-white border-2 border-[#191D19] rounded-xl p-3.5 text-xs font-medium text-[#4A5049] text-center">
          🔒 Location & camera are accessed only when you tap <b>Mark Attendance</b>.
        </div>
      </main>
    </div>
  );
}