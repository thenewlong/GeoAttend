import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '../api/client';

const WEEK_DAYS = [
  { id: 0, label: 'Sunday' },
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
];

function formatMonthLabel(ymKey) {
  if (!ymKey || ymKey === 'all') return 'All Months';
  const [y, m] = ymKey.split('-').map(Number);
  if (!y || !m) return ymKey;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function getMonthWorkingDaysCount(ymKey, weeklyOff = [], holidays = [], upToDateStr = '') {
  if (!ymKey || ymKey === 'all') return 0;
  const [y, m] = ymKey.split('-').map(Number);
  if (!y || !m) return 0;

  const daysInMonth = new Date(y, m, 0).getDate();
  const holidayMap = new Map(
    (holidays || []).map((h) => [String(h.holiday_date || '').slice(0, 10), h])
  );
  const offSet = new Set((weeklyOff || []).map(Number));

  let workingDays = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const mm = String(m).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${y}-${mm}-${dd}`;
    if (upToDateStr && dateStr > upToDateStr) break;

    const dt = new Date(y, m - 1, day);
    const dow = dt.getDay();
    const hol = holidayMap.get(dateStr);

    if (hol) {
      if (hol.is_working_override) workingDays += 1;
    } else if (!offSet.has(dow)) {
      workingDays += 1;
    }
  }
  return workingDays;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview'); // 'overview' | 'attendance' | 'employees' | 'policy' | 'holidays'
  const [overview, setOverview] = useState(null);
  const [allRecords, setAllRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Employee attendance inspector filters
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');

  // New employee form state
  const [form, setForm] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    dept: 'Training',
    designation: 'Staff',
  });

  // New holiday form state
  const [holidayForm, setHolidayForm] = useState({
    holiday_date: '',
    name: '',
    description: '',
    is_working_override: false,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErr('');
      const [ovData, empData, polData, holData] = await Promise.all([
        apiRequest('/admin/overview'),
        apiRequest('/admin/employees'),
        apiRequest('/admin/policy'),
        apiRequest('/admin/holidays'),
      ]);

      let extraRecords = [];
      try {
        const recData = await apiRequest('/admin/records');
        if (Array.isArray(recData?.records)) {
          extraRecords = recData.records;
        }
      } catch {
        // Optional endpoint fallback; overview records will still be used
      }

      const mergedMap = new Map();
      for (const r of [...(ovData?.recentRecords || []), ...extraRecords]) {
        const key = r.id ?? `${r.employee_id}-${String(r.attendance_date).slice(0, 10)}-${r.check_in_time}`;
        mergedMap.set(key, r);
      }

      setOverview(ovData);
      setAllRecords(Array.from(mergedMap.values()));
      setEmployees(empData.employees || []);
      setPolicy(
        polData.policy
          ? { ...polData.policy, weekly_off: polData.policy.weekly_off || [] }
          : null
      );
      setHolidays(holData.holidays || []);
    } catch (e) {
      setErr(e.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const employeeListOnly = useMemo(
    () => employees.filter((u) => u.role === 'employee'),
    [employees]
  );

  const availableMonths = useMemo(() => {
    const set = new Set([defaultMonth]);
    for (const r of allRecords) {
      const ym = String(r.attendance_date || '').slice(0, 7);
      if (ym) set.add(ym);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allRecords, defaultMonth]);

  const perEmployeeSummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const totalWorkingDays = getMonthWorkingDaysCount(
      selectedMonth,
      policy?.weekly_off || [],
      holidays,
      todayStr
    );

    const monthRecords =
      selectedMonth === 'all'
        ? allRecords
        : allRecords.filter((r) => String(r.attendance_date || '').slice(0, 7) === selectedMonth);

    return employeeListOnly.map((emp) => {
      const empRecs = monthRecords.filter((r) => String(r.employee_id) === String(emp.id));
      const uniquePresentDates = new Set(
        empRecs
          .filter((r) => String(r.status || 'Present').toLowerCase() !== 'absent')
          .map((r) => String(r.attendance_date || '').slice(0, 10))
          .filter(Boolean)
      );

      const presentDays = uniquePresentDates.size;
      const absentDays =
        selectedMonth === 'all'
          ? 0
          : Math.max(0, totalWorkingDays - presentDays);

      return {
        employee: emp,
        presentDays,
        absentDays,
        totalWorkingDays,
        records: empRecs,
      };
    });
  }, [employeeListOnly, allRecords, selectedMonth, policy, holidays]);

  const filteredEmployeeLogs = useMemo(() => {
    const monthRecords =
      selectedMonth === 'all'
        ? allRecords
        : allRecords.filter((r) => String(r.attendance_date || '').slice(0, 7) === selectedMonth);

    const byEmp =
      selectedEmployeeId === 'all'
        ? monthRecords
        : monthRecords.filter((r) => String(r.employee_id) === String(selectedEmployeeId));

    return [...byEmp].sort((a, b) => {
      const dA = String(a.attendance_date || '').slice(0, 10);
      const dB = String(b.attendance_date || '').slice(0, 10);
      if (dA !== dB) return dB.localeCompare(dA);
      return String(b.check_in_time || '').localeCompare(String(a.check_in_time || ''));
    });
  }, [allRecords, selectedMonth, selectedEmployeeId]);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await apiRequest('/admin/employees', {
        method: 'POST',
        body: { ...form, role: 'employee' },
      });
      setForm({ id: '', name: '', email: '', password: '', dept: 'Training', designation: 'Staff' });
      setMsg('Employee added successfully.');
      await loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleToggleEmployee = async (id) => {
    setMsg('');
    setErr('');
    try {
      await apiRequest(`/admin/employees/${id}/toggle`, { method: 'PATCH' });
      await loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm(`Delete employee ${id}?`)) return;
    setMsg('');
    setErr('');
    try {
      await apiRequest(`/admin/employees/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  const toggleWeeklyOffDay = (dayId) => {
    if (!policy) return;
    const current = Array.isArray(policy.weekly_off) ? policy.weekly_off : [];
    const exists = current.includes(dayId);
    const updatedDays = exists
      ? current.filter((d) => d !== dayId)
      : [...current, dayId].sort((a, b) => a - b);

    setPolicy({ ...policy, weekly_off: updatedDays });
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      const updated = await apiRequest('/admin/policy', {
        method: 'PUT',
        body: policy,
      });
      setPolicy({ ...updated.policy, weekly_off: updated.policy.weekly_off || [] });
      setMsg('Policy & Weekly Off days updated in PostgreSQL.');
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    try {
      await apiRequest('/admin/holidays', {
        method: 'POST',
        body: holidayForm,
      });
      setHolidayForm({ holiday_date: '', name: '', description: '', is_working_override: false });
      setMsg('Holiday / schedule override saved.');
      await loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleDeleteHoliday = async (id) => {
    setMsg('');
    setErr('');
    try {
      await apiRequest(`/admin/holidays/${id}`, { method: 'DELETE' });
      setMsg('Holiday removed.');
      await loadData();
    } catch (e) {
      setErr(e.message);
    }
  };

  if (loading && !overview) {
    return <div className="max-w-5xl mx-auto p-8 text-sm text-gray-500">Loading admin console...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Admin Control Centre
          </span>
          <h2 className="text-2xl font-bold text-gray-900">GeoAttend Administration</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {['overview', 'attendance', 'employees', 'policy', 'holidays'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setMsg('');
                setErr('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase cursor-pointer ${
                tab === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          {msg}
        </div>
      )}
      {err && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {err}
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 p-5 rounded-2xl">
              <div className="text-2xl font-bold text-gray-900">{overview.stats.totalEmployees}</div>
              <div className="text-xs text-gray-500 mt-1">Total Employees</div>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-2xl">
              <div className="text-2xl font-bold text-emerald-600">{overview.stats.presentToday}</div>
              <div className="text-xs text-gray-500 mt-1">Present Today</div>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-2xl">
              <div className="text-2xl font-bold text-rose-600">{overview.stats.absentToday}</div>
              <div className="text-xs text-gray-500 mt-1">Absent Today</div>
            </div>
            <div className="bg-white border border-gray-200 p-5 rounded-2xl">
              <div className="text-2xl font-bold text-gray-900">{overview.stats.rateToday}%</div>
              <div className="text-xs text-gray-500 mt-1">Attendance Rate</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">Recent Attendance Logs (with ImgBB Selfies)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Distance</th>
                    <th className="py-2 pr-4">Selfie</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview.recentRecords || []).map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {r.name} <span className="text-xs text-gray-400">({r.employee_id})</span>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{String(r.attendance_date).slice(0, 10)}</td>
                      <td className="py-3 pr-4 text-gray-600">{String(r.check_in_time).slice(0, 5)}</td>
                      <td className="py-3 pr-4 text-gray-600">{r.distance_meters}m</td>
                      <td className="py-3 pr-4">
                        {r.selfie_url ? (
                          <a href={r.selfie_url} target="_blank" rel="noreferrer">
                            <img
                              src={r.selfie_url}
                              alt={r.name}
                              className="w-12 h-10 object-cover rounded-lg border border-gray-200"
                            />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!overview.recentRecords || overview.recentRecords.length === 0) && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-gray-400 text-xs">
                        Abhi koi attendance record nahi hai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EVERY EMPLOYEE ATTENDANCE (PRESENT / ABSENT / MONTH / DATE) */}
      {tab === 'attendance' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All Months</option>
                  {availableMonths.map((ym) => (
                    <option key={ym} value={ym}>
                      {formatMonthLabel(ym)} ({ym})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="all">All Employees ({employeeListOnly.length})</option>
                  {employeeListOnly.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Month: <b>{formatMonthLabel(selectedMonth)}</b>
            </div>
          </div>

          {/* Per-Employee Present / Absent Summary Table */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">
              Employee-wise Present & Absent Summary ({formatMonthLabel(selectedMonth)})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Dept</th>
                    <th className="py-2 pr-4">Present Days</th>
                    <th className="py-2 pr-4">Absent Days</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {perEmployeeSummary.map((item) => {
                    const isSelected = String(selectedEmployeeId) === String(item.employee.id);
                    return (
                      <tr key={item.employee.id} className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-gray-900">
                          {item.employee.name}{' '}
                          <span className="text-xs text-gray-400">({item.employee.id})</span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{item.employee.dept || 'General'}</td>
                        <td className="py-3 pr-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                            {item.presentDays} Present
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                            {selectedMonth === 'all' ? '—' : `${item.absentDays} Absent`}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedEmployeeId(isSelected ? 'all' : item.employee.id)
                            }
                            className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium cursor-pointer"
                          >
                            {isSelected ? 'Show All' : 'View Dates'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {perEmployeeSummary.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-6 text-center text-gray-400 text-xs">
                        Koi employee record nahi mila.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Date-wise Attendance Log for Selected Employee / All */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-base">
              Date-wise Attendance Entries ({filteredEmployeeLogs.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Distance</th>
                    <th className="py-2 pr-4">Selfie</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployeeLogs.map((r) => (
                    <tr key={r.id ?? `${r.employee_id}-${r.attendance_date}-${r.check_in_time}`} className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {r.name || r.employee_id}{' '}
                        <span className="text-xs text-gray-400">({r.employee_id})</span>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {String(r.attendance_date || '').slice(0, 10)}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {String(r.check_in_time || '').slice(0, 5)}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {r.distance_meters != null ? `${r.distance_meters}m` : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        {r.selfie_url ? (
                          <a href={r.selfie_url} target="_blank" rel="noreferrer">
                            <img
                              src={r.selfie_url}
                              alt={r.name || r.employee_id}
                              className="w-12 h-10 object-cover rounded-lg border border-gray-200"
                            />
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          {r.status || 'Present'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployeeLogs.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-gray-400 text-xs">
                        Is filter ke liye koi attendance date record nahi hai.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EMPLOYEES */}
      {tab === 'employees' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddEmployee}
            className="bg-white border border-gray-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <input
              placeholder="Employee ID (e.g. E002)"
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              className="border border-gray-300 rounded-xl p-2.5 text-sm"
            />
            <input
              placeholder="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border border-gray-300 rounded-xl p-2.5 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border border-gray-300 rounded-xl p-2.5 text-sm"
            />
            <input
              type="password"
              placeholder="Initial Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="border border-gray-300 rounded-xl p-2.5 text-sm"
            />
            <input
              placeholder="Department"
              value={form.dept}
              onChange={(e) => setForm({ ...form, dept: e.target.value })}
              className="border border-gray-300 rounded-xl p-2.5 text-sm"
            />
            <input
              placeholder="Designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              className="border border-gray-300 rounded-xl p-2.5 text-sm"
            />
            <div className="md:col-span-3">
              <button
                type="submit"
                className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                + Add Employee
              </button>
            </div>
          </form>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Dept</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-mono text-xs">{u.id}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{u.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{u.email}</td>
                    <td className="py-3 pr-4 text-gray-600">{u.dept}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleEmployee(u.id)}
                        className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium cursor-pointer"
                      >
                        Toggle
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEmployee(u.id)}
                          className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: POLICY & WEEKLY OFF */}
      {tab === 'policy' && policy && (
        <form
          onSubmit={handleSavePolicy}
          className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Campus Latitude</label>
              <input
                type="number"
                step="any"
                value={policy.campus_lat}
                onChange={(e) => setPolicy({ ...policy, campus_lat: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Campus Longitude</label>
              <input
                type="number"
                step="any"
                value={policy.campus_lng}
                onChange={(e) => setPolicy({ ...policy, campus_lng: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Radius (meters)</label>
              <input
                type="number"
                value={policy.radius_meters}
                onChange={(e) => setPolicy({ ...policy, radius_meters: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Window Start</label>
              <input
                type="time"
                value={String(policy.window_start || '09:00').slice(0, 5)}
                onChange={(e) => setPolicy({ ...policy, window_start: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Window End</label>
              <input
                type="time"
                value={String(policy.window_end || '4:30').slice(0, 5)}
                onChange={(e) => setPolicy({ ...policy, window_end: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Max GPS Accuracy (m)</label>
              <input
                type="number"
                value={policy.max_accuracy_meters}
                onChange={(e) => setPolicy({ ...policy, max_accuracy_meters: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
          </div>

          {/* Interactive Weekly Off Selector */}
          <div className="border-t border-gray-100 pt-5 space-y-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Weekly Off Days (Selected days par attendance band rahegi)
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map((day) => {
                const isOff = (policy.weekly_off || []).includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleWeeklyOffDay(day.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isOff
                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {isOff ? `✓ ${day.label} (Off)` : day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500">
              Abhi select kiye gaye weekly off days:{' '}
              <b>
                {(policy.weekly_off || []).length === 0
                  ? 'None (7 days open)'
                  : WEEK_DAYS.filter((d) => policy.weekly_off.includes(d.id))
                      .map((d) => d.label)
                      .join(', ')}
              </b>
            </p>
          </div>

          <div>
            <button
              type="submit"
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Save Policy & Weekly Off
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: HOLIDAYS & SPECIAL WORKING DAYS */}
      {tab === 'holidays' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddHoliday}
            className="bg-white border border-gray-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={holidayForm.holiday_date}
                onChange={(e) => setHolidayForm({ ...holidayForm, holiday_date: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Holiday Name</label>
              <input
                placeholder="e.g. Republic Day"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
              <select
                value={holidayForm.is_working_override ? 'true' : 'false'}
                onChange={(e) =>
                  setHolidayForm({ ...holidayForm, is_working_override: e.target.value === 'true' })
                }
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm bg-white"
              >
                <option value="false">Holiday (Attendance Closed)</option>
                <option value="true">Special Working Day (Override Weekly Off)</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                + Save Date
              </button>
            </div>
          </form>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Rule</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-mono text-xs">{String(h.holiday_date).slice(0, 10)}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{h.name}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          h.is_working_override
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {h.is_working_override ? 'Working Day Override' : 'Holiday'}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(h.id)}
                        className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {holidays.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-gray-400 text-xs">
                      Koi holiday configured nahi hai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}