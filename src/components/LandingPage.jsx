import React, { useEffect, useRef, useState } from 'react';

function useScrollReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

function BrutalistCard({ children, className = '', delayMs = 0 }) {
  const [ref, visible] = useScrollReveal();

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`border-2 border-[#191D19] rounded-2xl shadow-[5px_5px_0_#191D19] transition-all duration-500 ease-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[7px_7px_0_#191D19] ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default function LandingPage({ onOpenLogin }) {
  const workflowSteps = [
    {
      num: '01',
      stepLabel: 'STEP 01',
      title: 'ACCOUNT ACCESS',
      desc: 'Employees sign in with their assigned ID or email with persistent session support.',
      cardBg: 'bg-[#FFD84D] text-[#191D19]',
      subLabelColor: 'text-[#4A4216]',
    },
    {
      num: '02',
      stepLabel: 'STEP 02',
      title: 'LOCATION CHECK',
      desc: 'Browser fetches real-time GPS coordinates when you start employee attendance.',
      cardBg: 'bg-[#F2F4EC] text-[#191D19]',
      subLabelColor: 'text-[#666E64]',
    },
    {
      num: '03',
      stepLabel: 'STEP 03',
      title: 'GEOFENCE',
      desc: 'Coordinates are verified against the NIELIT Agartala campus boundary and radius.',
      cardBg: 'bg-[#7A9672] text-[#191D19]',
      subLabelColor: 'text-[#283625]',
    },
    {
      num: '04',
      stepLabel: 'STEP 04',
      title: 'TIME WINDOW',
      desc: 'Accepted only inside the admin-configured check-in window and working days.',
      cardBg: 'bg-[#FFD84D] text-[#191D19]',
      subLabelColor: 'text-[#4A4216]',
    },
    {
      num: '05',
      stepLabel: 'STEP 05',
      title: 'LIVE SELFIE',
      desc: 'Open the front camera, capture a fresh live selfie, and upload securely via backend.',
      cardBg: 'bg-[#F2F4EC] text-[#191D19]',
      subLabelColor: 'text-[#666E64]',
    },
    {
      num: '06',
      stepLabel: 'STEP 06',
      title: 'CONFIRMATION',
      desc: 'All checks verified; attendance record is saved in PostgreSQL with a reference code.',
      cardBg: 'bg-[#7A9672] text-[#191D19]',
      subLabelColor: 'text-[#283625]',
    },
  ];

  const workflowFeatures = [
    {
      num: '01',
      title: 'GPS Geofencing',
      desc: 'Verify whether an employee is inside the allowed campus radius.',
      bg: 'bg-[#E8EFE4]',
      tag: 'Geofence',
    },
    {
      num: '02',
      title: 'Live Selfie Capture',
      desc: 'Capture a fresh front-camera photo uploaded via backend to ImgBB.',
      bg: 'bg-white',
      tag: 'Camera',
    },
    {
      num: '03',
      title: 'Time-Based Attendance',
      desc: 'Enforce configurable check-in windows and GPS accuracy thresholds.',
      bg: 'bg-white',
      tag: 'Policy Rule',
    },
    {
      num: '04',
      title: 'Employee Dashboard',
      desc: 'Personal check-in status, reference codes, distance logs, and history.',
      bg: 'bg-[#E8EFE4]',
      tag: 'Employee',
    },
    {
      num: '05',
      title: 'Admin Control Centre',
      desc: 'Manage employees, geofence radius, time windows, and daily overview.',
      bg: 'bg-[#E8EFE4]',
      tag: 'Admin',
    },
    {
      num: '06',
      title: 'Holiday Management',
      desc: 'Holidays disable check-ins; special working days supported via override.',
      bg: 'bg-white',
      tag: 'Policy Rule',
    },
    {
      num: '07',
      title: 'Attendance Records & Logs',
      desc: 'Structured check-in entries with timestamps, coordinates, and selfie URLs.',
      bg: 'bg-white',
      tag: 'PostgreSQL',
    },
    {
      num: '08',
      title: 'Audit History',
      desc: 'Administrative policy and employee changes are tracked in audit logs.',
      bg: 'bg-[#E8EFE4]',
      tag: 'Admin',
    },
    {
      num: '09',
      title: 'Role-Based Workspaces',
      desc: 'Dedicated Employee and Admin portals with token-based authentication.',
      bg: 'bg-white',
      tag: 'Security',
    },
    {
      num: '10',
      title: 'Weekly Off Configuration',
      desc: 'Flexible 7-day or custom weekly off schedule controlled by admin.',
      bg: 'bg-white',
      tag: 'Policy Rule',
    },
    {
      num: '11',
      title: 'Duplicate Entry Protection',
      desc: 'Prevents multiple check-ins on the same day for the same employee ID.',
      bg: 'bg-white',
      tag: 'Validation',
    },
    {
      num: '12',
      title: 'Mobile & Desktop Ready',
      desc: 'Responsive interface crafted for smartphones on campus and PCs in offices.',
      bg: 'bg-[#E8EFE4]',
      tag: 'All Devices',
    },
  ];

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F3] text-[#191D19] selection:bg-[#FFD84D] selection:text-[#191D19]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#F8F8F3]/95 backdrop-blur-sm border-b-2 border-[#191D19]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-[#4E6B47] border-2 border-[#191D19] shadow-[2px_2px_0_#191D19] flex items-center justify-center text-white font-bold text-sm">
              ⌖
            </div>
            <div className="truncate">
              <div className="font-extrabold text-sm sm:text-base tracking-tight leading-none truncate">
                NIELIT GeoAttend
              </div>
              
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#2E352D]">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[#4E6B47] transition-colors cursor-pointer"
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-[#4E6B47] transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('security')}
              className="hover:text-[#4E6B47] transition-colors cursor-pointer"
            >
              Security
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            
            <button
              type="button"
              onClick={onOpenLogin}
              className="bg-[#4E6B47] hover:bg-[#425B3C] text-white font-bold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-12 sm:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-8 space-y-5">
              <div className="inline-flex items-center gap-2 bg-[#E8EFE4] border-2 border-[#191D19] rounded-xl px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_#191D19]">
                <span className="w-2 h-2 rounded-full bg-[#4E6B47]" />
                <span>NIELIT AGARTALA · EMPLOYEE ATTENDANCE SYSTEM</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.04]">
                Attendance you can{' '}
                <span className="text-[#4E6B47] underline decoration-4 underline-offset-4">
                  verify.
                </span>
                <br />
                Policies you can trust.
              </h1>

              <p className="text-sm sm:text-base lg:text-lg text-[#464D45] max-w-2xl leading-relaxed font-medium">
                A clearer attendance workflow for{' '}
                <strong className="text-[#191D19]">NIELIT Agartala employees</strong> and
                administrators. Bring GPS location checks, live selfie capture, and configurable
                campus rules into one accountable experience.
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="bg-[#4E6B47] hover:bg-[#41593B] text-white font-bold text-sm sm:text-base px-5 sm:px-6 py-3 rounded-xl border-2 border-[#191D19] shadow-[4px_4px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  Employee / Admin Login →
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works')}
                  className="bg-white hover:bg-[#F2F4EC] text-[#191D19] font-bold text-sm sm:text-base px-5 sm:px-6 py-3 rounded-xl border-2 border-[#191D19] shadow-[4px_4px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  See How It Works
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs sm:text-sm font-bold text-[#2E352D]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#191D19] inline-block" />
                  Role-based workspaces
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#191D19] inline-block" />
                  Privacy-aware design
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#191D19] inline-block" />
                  Audit-ready records
                </span>
              </div>
            </div>

            {/* Right Summary Card (Mobile + Desktop friendly) */}
            <div className="lg:col-span-4">
              <BrutalistCard className="bg-white p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-[#191D19] pb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#4E6B47]">
                    Employee Check-In
                  </span>
                  <span className="bg-[#FFD84D] border-2 border-[#191D19] rounded-lg px-2.5 py-0.5 text-[11px] font-extrabold">
                    LIVE
                  </span>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="bg-[#F8F8F3] border-2 border-[#191D19] rounded-xl p-3">
                    <div className="font-extrabold">1. Geofence & Time Check</div>
                    <div className="text-[#4A5049] mt-0.5">
                      Checks campus distance, GPS accuracy, working days, and time window.
                    </div>
                  </div>
                  <div className="bg-[#E8EFE4] border-2 border-[#191D19] rounded-xl p-3">
                    <div className="font-extrabold">2. Live Selfie Capture</div>
                    <div className="text-[#3C463A] mt-0.5">
                      Captures front-camera selfie and uploads securely via backend.
                    </div>
                  </div>
                  <div className="bg-[#FFF8DC] border-2 border-[#191D19] rounded-xl p-3">
                    <div className="font-extrabold">3. Instant PostgreSQL Log</div>
                    <div className="text-[#595232] mt-0.5">
                      Generates a verified attendance receipt with reference code and timestamp.
                    </div>
                  </div>
                </div>
              </BrutalistCard>
            </div>
          </div>
        </section>

        {/* Dark Green Step-by-Step Section */}
        <section
          id="how-it-works"
          className="bg-[#2F4531] text-white border-y-2 border-[#191D19] py-12 sm:py-16 scroll-mt-16"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#CBE0C8] mb-1.5">
                  Employee Check-In Flow
                </p>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
                  From campus location to verified attendance.
                </h2>
              </div>
              <span className="self-start sm:self-auto bg-[#FFD84D] text-[#191D19] border-2 border-[#191D19] rounded-xl px-3 py-1 text-xs font-extrabold shadow-[3px_3px_0_#191D19]">
                6-Step Employee Flow
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {workflowSteps.map((step, idx) => (
                <BrutalistCard
                  key={step.num}
                  delayMs={idx * 70}
                  className={`${step.cardBg} p-5 flex flex-col justify-between min-h-[170px]`}
                >
                  <div>
                    <div className="text-3xl sm:text-4xl font-black leading-none tracking-tight">
                      {step.num}
                    </div>
                    <div
                      className={`text-[10px] font-extrabold tracking-widest uppercase mt-2 ${step.subLabelColor}`}
                    >
                      {step.stepLabel}
                    </div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight mt-1">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm font-medium leading-relaxed mt-3 opacity-95">
                    {step.desc}
                  </p>
                </BrutalistCard>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid Section */}
        <section
          id="features"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8 scroll-mt-16"
        >
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#4E6B47]">
              Platform Capabilities
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              Everything the workflow needs.
            </h2>
            <p className="text-sm sm:text-base text-[#4A5049] font-medium">
              Designed around employee attendance operations, GPS policy verification, and
              administrative oversight.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {workflowFeatures.map((item, idx) => (
              <BrutalistCard
                key={item.num}
                delayMs={(idx % 4) * 65}
                className={`${item.bg} p-5 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center justify-center px-2 h-6 rounded-md bg-[#E8EFE4] border-2 border-[#191D19] text-xs font-extrabold">
                      {item.num}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border border-[#191D19] bg-[#F8F8F3]">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold tracking-tight text-[#191D19]">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#4A5049] mt-1.5 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>
              </BrutalistCard>
            ))}
          </div>
        </section>

        {/* Privacy & Security Section */}
        <section
          id="security"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 scroll-mt-16"
        >
          <BrutalistCard className="bg-white p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs sm:text-sm font-semibold text-[#3C423B] text-center sm:text-left">
              🔒 Location & camera are accessed only when an employee starts attendance check-in.
            </p>
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full sm:w-auto shrink-0 bg-[#FFD84D] hover:bg-[#F5CC36] text-[#191D19] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
            >
              Proceed to Login →
            </button>
          </BrutalistCard>
        </section>
      </main>
    </div>
  );
}