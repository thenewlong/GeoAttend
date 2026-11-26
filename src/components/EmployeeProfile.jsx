import React, { useMemo, useState } from 'react';

function formatMonthLabel(ymKey) {
  if (!ymKey || ymKey === 'all') return 'All Months';
  const [year, month] = ymKey.split('-').map(Number);
  if (!year || !month) return ymKey;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatTime12(hhmm) {
  if (!hhmm) return '-';
  const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(hhmm);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function EmployeeProfile({ user, records = [], onLogout, onBackHome }) {
  const [selectedMonth, setSelectedMonth] = useState('all');

  const initial = (user?.name || 'E')[0].toUpperCase();

  // Group records by YYYY-MM month
  const monthlyStats = useMemo(() => {
    const map = new Map();

    for (const rec of records) {
      const dateStr = String(rec.attendance_date || '').slice(0, 10);
      if (!dateStr) continue;
      const ym = dateStr.slice(0, 7);

      if (!map.has(ym)) {
        map.set(ym, {
          monthKey: ym,
          label: formatMonthLabel(ym),
          presentCount: 0,
          dates: [],
        });
      }

      const entry = map.get(ym);
      const isPresent = String(rec.status || 'Present').toLowerCase() !== 'absent';
      if (isPresent) {
        entry.presentCount += 1;
      }
      entry.dates.push(dateStr);
    }

    return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const list =
      selectedMonth === 'all'
        ? records
        : records.filter(
            (r) => String(r.attendance_date || '').slice(0, 7) === selectedMonth
          );

    return [...list].sort((a, b) => {
      const dA = String(a.attendance_date || '').slice(0, 10);
      const dB = String(b.attendance_date || '').slice(0, 10);
      if (dA !== dB) return dB.localeCompare(dA);
      return String(b.check_in_time || '').localeCompare(String(a.check_in_time || ''));
    });
  }, [records, selectedMonth]);

  const activeMonthPresentDays = useMemo(() => {
    return filteredRecords.filter(
      (r) => String(r.status || 'Present').toLowerCase() !== 'absent'
    ).length;
  }, [filteredRecords]);

  return (
    <div className="max-w-md sm:max-w-3xl mx-auto space-y-5 text-[#191D19]">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My Profile</h2>
          <p className="text-xs sm:text-sm text-[#5E645D] font-medium">
            Employee details & month-wise attendance log
          </p>
        </div>
        {typeof onBackHome === 'function' && (
          <button
            type="button"
            onClick={onBackHome}
            className="bg-white border-2 border-[#191D19] rounded-xl px-3.5 py-2 text-xs font-bold shadow-[2px_2px_0_#191D19] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
          >
            ← Home
          </button>
        )}
      </div>

      {/* Profile + Quick Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
        <div className="sm:col-span-7 bg-white border-2 border-[#191D19] rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0_#191D19] flex flex-col justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full bg-[#FFD84D] border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] flex items-center justify-center text-xl sm:text-2xl font-extrabold">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-extrabold truncate">
                {user?.name || 'Employee'}
              </div>
              <div className="text-xs font-bold text-[#5E645D] mt-0.5 truncate">
                {user?.id || 'ID'} • {user?.dept || 'General'} • {user?.designation || 'Staff'}
              </div>
              <div className="text-xs text-[#5E645D] mt-1 truncate">{user?.email || ''}</div>
            </div>
          </div>

          <div className="bg-[#F8F8F3] border-2 border-[#191D19] rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[#5E645D] font-bold block">Department</span>
              <span className="font-extrabold">{user?.dept || 'General'}</span>
            </div>
            <div>
              <span className="text-[#5E645D] font-bold block">Campus</span>
              <span className="font-extrabold">NIELIT Agartala</span>
            </div>
          </div>
        </div>

        <div className="sm:col-span-5 bg-white border-2 border-[#191D19] rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0_#191D19] flex flex-col justify-between gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#E8EFE4] border-2 border-[#191D19] rounded-xl p-3">
              <div className="text-[11px] font-bold text-[#4A5049]">Total Present</div>
              <div className="text-xl sm:text-2xl font-extrabold mt-0.5">{records.length}</div>
            </div>
            <div className="bg-[#FFD84D] border-2 border-[#191D19] rounded-xl p-3">
              <div className="text-[11px] font-bold text-[#4A4216]">
                {selectedMonth === 'all' ? 'Months' : 'Month Present'}
              </div>
              <div className="text-xl sm:text-2xl font-extrabold mt-0.5">
                {selectedMonth === 'all' ? monthlyStats.length : activeMonthPresentDays}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full bg-[#E4572E] text-white font-bold text-sm py-3 rounded-xl border-2 border-[#191D19] shadow-[3px_3px_0_#191D19] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Month-wise Present Summary Cards (Admin Style) */}
      <div className="bg-white border-2 border-[#191D19] rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0_#191D19] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
            Month-wise Attendance Summary
          </h3>
          <button
            type="button"
            onClick={() => setSelectedMonth('all')}
            className={`self-start sm:self-auto px-3 py-1 rounded-xl border-2 border-[#191D19] text-xs font-bold cursor-pointer ${
              selectedMonth === 'all' ? 'bg-[#6B8A63] text-white' : 'bg-[#F8F8F3] text-[#191D19]'
            }`}
          >
            All Months ({records.length})
          </button>
        </div>

        {monthlyStats.length === 0 ? (
          <div className="bg-[#F8F8F3] border-2 border-[#191D19] rounded-xl p-4 text-xs sm:text-sm font-medium text-[#5E645D]">
            Abhi koi attendance record available nahi hai.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthlyStats.map((m) => {
              const isSelected = selectedMonth === m.monthKey;
              return (
                <button
                  key={m.monthKey}
                  type="button"
                  onClick={() => setSelectedMonth(isSelected ? 'all' : m.monthKey)}
                  className={`text-left rounded-xl border-2 border-[#191D19] p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#E8EFE4] shadow-[3px_3px_0_#191D19]'
                      : 'bg-[#F8F8F3] hover:bg-[#E8EFE4]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold">{m.label}</span>
                    <span className="bg-[#6B8A63] text-white text-[11px] font-bold px-2 py-0.5 rounded-lg border border-[#191D19]">
                      {m.presentCount} Present
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#5E645D] mt-1.5">
                    Tap to {isSelected ? 'show all months' : 'filter dates'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Date-wise Attendance Log (Mobile Cards + PC Table) */}
      <div className="bg-white border-2 border-[#191D19] rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0_#191D19] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
              Date-wise Attendance ({formatMonthLabel(selectedMonth)})
            </h3>
            <p className="text-xs text-[#5E645D] font-semibold mt-0.5">
              Present days in view: <span className="text-[#191D19] font-extrabold">{activeMonthPresentDays}</span>
            </p>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="bg-[#F8F8F3] border-2 border-[#191D19] rounded-xl p-4 text-xs sm:text-sm font-medium text-[#5E645D]">
            Is selection ke liye koi date record nahi mila.
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="space-y-3 sm:hidden">
              {filteredRecords.map((rec) => {
                const dateStr = String(rec.attendance_date || '').slice(0, 10);
                return (
                  <div
                    key={rec.id}
                    className="bg-[#F8F8F3] border-2 border-[#191D19] rounded-xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm">{dateStr}</div>
                      <div className="text-xs text-[#5E645D] mt-0.5">
                        {formatTime12(rec.check_in_time)} • {rec.distance_meters ?? '-'}m
                      </div>
                      <div className="text-[11px] font-bold text-[#4A5049] mt-0.5 truncate">
                        Ref: {rec.ref_code || '-'}
                      </div>
                    </div>
                    <span className="shrink-0 bg-[#6B8A63] text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-[#191D19]">
                      {rec.status || 'Present'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* PC / Tablet Table View */}
            <div className="hidden sm:block overflow-x-auto border-2 border-[#191D19] rounded-xl">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#E8EFE4] border-b-2 border-[#191D19] font-extrabold">
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3.5">Month</th>
                    <th className="py-2.5 px-3.5">Check-In Time</th>
                    <th className="py-2.5 px-3.5">Distance</th>
                    <th className="py-2.5 px-3.5">Ref Code</th>
                    <th className="py-2.5 px-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EFE4] bg-white">
                  {filteredRecords.map((rec) => {
                    const dateStr = String(rec.attendance_date || '').slice(0, 10);
                    return (
                      <tr key={rec.id} className="hover:bg-[#F8F8F3]">
                        <td className="py-2.5 px-3.5 font-extrabold">{dateStr}</td>
                        <td className="py-2.5 px-3.5 font-semibold text-[#5E645D]">
                          {formatMonthLabel(dateStr.slice(0, 7))}
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold">
                          {formatTime12(rec.check_in_time)}
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold">
                          {rec.distance_meters ?? '-'} m
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-xs">
                          {rec.ref_code || '-'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className="bg-[#6B8A63] text-white text-xs font-bold px-2.5 py-0.5 rounded-lg border border-[#191D19]">
                            {rec.status || 'Present'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}