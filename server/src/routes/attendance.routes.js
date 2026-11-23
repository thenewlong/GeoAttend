import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { haversineMeters, isWithinTimeWindow } from '../services/geo.service.js';
import { uploadSelfieToImgBB } from '../services/imgbb.service.js';

const router = Router();

function getIstNow(date = new Date()) {
  const istString = date.toLocaleString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Format in en-CA: "YYYY-MM-DD, HH:MM:SS"
  const [datePart, timePart] = istString.split(',').map((s) => s.trim());
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);

  // Construct a Date representing IST wall-clock components safely for dayOfWeek & window check
  const istWallDate = new Date(y, m - 1, d, hh, mm, ss);

  return {
    todayStr: datePart,
    dayOfWeek: istWallDate.getDay(), // 0 = Sun ... 6 = Sat
    timeHHMMSS: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
    istWallDate,
  };
}

// Combined payload for Employee Mobile Dashboard (Home + History)
router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const employeeId = req.user.id;
    const { todayStr } = getIstNow();

    const [polRes, todayRes, recentRes] = await Promise.all([
      pool.query('SELECT * FROM attendance_policies WHERE id = 1'),
      pool.query(
        `SELECT id, ref_code, attendance_date, check_in_time, distance_meters, selfie_url, status
         FROM attendance_records
         WHERE employee_id = $1 AND attendance_date = $2`,
        [employeeId, todayStr]
      ),
      pool.query(
        `SELECT id, ref_code, attendance_date, check_in_time, distance_meters, selfie_url, status
         FROM attendance_records
         WHERE employee_id = $1
         ORDER BY attendance_date DESC, check_in_time DESC
         LIMIT 20`,
        [employeeId]
      ),
    ]);

    const rawPolicy = polRes.rows[0] || null;
    const policy = rawPolicy
      ? {
          ...rawPolicy,
          weekly_off: Array.isArray(rawPolicy.weekly_off) ? rawPolicy.weekly_off : [],
        }
      : null;

    res.json({
      policy,
      todayRecord: todayRes.rows[0] || null,
      records: recentRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// Mark attendance (GPS + Time Window + Holiday/Weekly-Off + ImgBB Selfie + PostgreSQL)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { lat, lng, accuracy = 0, selfieBase64 } = req.body;
    const employeeId = req.user.id;

    if (typeof lat !== 'number' || typeof lng !== 'number' || !selfieBase64) {
      return res.status(400).json({ error: 'lat, lng, and selfieBase64 are required' });
    }

    const polRes = await pool.query('SELECT * FROM attendance_policies WHERE id = 1');
    const policy = polRes.rows[0];
    if (!policy) {
      return res.status(500).json({ error: 'Attendance policy not configured' });
    }

    const weeklyOff = Array.isArray(policy.weekly_off) ? policy.weekly_off.map(Number) : [];
    const { todayStr, dayOfWeek, timeHHMMSS, istWallDate } = getIstNow();

    // 1. Duplicate check for today
    const dupRes = await pool.query(
      'SELECT id FROM attendance_records WHERE employee_id = $1 AND attendance_date = $2',
      [employeeId, todayStr]
    );
    if (dupRes.rowCount > 0) {
      return res.status(409).json({ error: 'Attendance already marked for today' });
    }

    // 2. Holiday / weekly-off check (supports 7-day open when weeklyOff is empty & working day overrides)
    const holRes = await pool.query('SELECT * FROM holidays WHERE holiday_date = $1', [todayStr]);
    const holiday = holRes.rows[0];
    const isHolidayClosed = Boolean(holiday && !holiday.is_working_override);
    const isWeeklyOffClosed = Boolean(!holiday && weeklyOff.includes(dayOfWeek));

    if (isHolidayClosed || isWeeklyOffClosed) {
      return res.status(403).json({
        error: isHolidayClosed
          ? `Attendance is disabled on holiday (${holiday.name})`
          : 'Attendance is disabled on weekly off day',
      });
    }

    // 3. Time window check
    const startHHMM = String(policy.window_start).slice(0, 5);
    const endHHMM = String(policy.window_end).slice(0, 5);
    if (!isWithinTimeWindow(startHHMM, endHHMM, istWallDate)) {
      return res.status(403).json({
        error: `Outside permitted attendance window (${startHHMM}–${endHHMM})`,
      });
    }

    // 4. Geofence & GPS accuracy check
    const distance = Math.round(
      haversineMeters(lat, lng, policy.campus_lat, policy.campus_lng)
    );
    if (distance > policy.radius_meters) {
      return res.status(403).json({
        error: `Outside campus radius (${distance}m > ${policy.radius_meters}m)`,
      });
    }
    if (accuracy && Number(accuracy) > Number(policy.max_accuracy_meters)) {
      return res.status(400).json({
        error: `GPS accuracy too low (${Math.round(accuracy)}m > ${policy.max_accuracy_meters}m)`,
      });
    }

    // 5. Upload selfie to ImgBB via backend
    const uploaded = await uploadSelfieToImgBB(selfieBase64, `${employeeId}-${todayStr}`);
    const refCode = `GA-${Date.now().toString(36).toUpperCase()}`;

    // 6. Save attendance record in PostgreSQL
    const insRes = await pool.query(
      `INSERT INTO attendance_records
        (ref_code, entity_type, employee_id, attendance_date, check_in_time, user_lat, user_lng, distance_meters, selfie_url, selfie_delete_url, status)
       VALUES ($1, 'employee', $2, $3, $4, $5, $6, $7, $8, $9, 'Present')
       RETURNING id, ref_code, employee_id, attendance_date, check_in_time, distance_meters, selfie_url, status`,
      [
        refCode,
        employeeId,
        todayStr,
        timeHHMMSS,
        lat,
        lng,
        distance,
        uploaded.url,
        uploaded.deleteUrl,
      ]
    );

    res.status(201).json({ record: insRes.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Logged-in employee attendance history
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, ref_code, attendance_date, check_in_time, distance_meters, selfie_url, status
       FROM attendance_records
       WHERE employee_id = $1
       ORDER BY attendance_date DESC, check_in_time DESC`,
      [req.user.id]
    );
    res.json({ records: r.rows });
  } catch (err) {
    next(err);
  }
});

export default router;