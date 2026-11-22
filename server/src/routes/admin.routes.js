import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

async function writeAudit(req, action) {
  await pool.query(
    'INSERT INTO audit_logs (actor_id, actor_name, action) VALUES ($1, $2, $3)',
    [req.user.id, req.user.name, action]
  );
}

// Get overview stats + recent check-ins + audit logs
router.get('/overview', async (_req, res, next) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [empRes, todayRes, recentRes, auditRes] = await Promise.all([
      pool.query("SELECT id, is_active FROM employees WHERE role = 'employee'"),
      pool.query(
        'SELECT COUNT(*)::int AS count FROM attendance_records WHERE attendance_date = $1',
        [todayStr]
      ),
      pool.query(
        `SELECT r.id, r.ref_code, r.attendance_date, r.check_in_time, r.distance_meters, r.selfie_url, r.status,
                e.name, e.dept, e.id AS employee_id
         FROM attendance_records r
         JOIN employees e ON e.id = r.employee_id
         ORDER BY r.created_at DESC
         LIMIT 20`
      ),
      pool.query('SELECT id, actor_name, action, created_at FROM audit_logs ORDER BY id DESC LIMIT 10'),
    ]);

    const totalEmployees = empRes.rows.length;
    const activeEmployees = empRes.rows.filter((u) => u.is_active).length;
    const presentToday = todayRes.rows[0]?.count || 0;

    res.json({
      stats: {
        totalEmployees,
        activeEmployees,
        presentToday,
        absentToday: Math.max(0, activeEmployees - presentToday),
        rateToday: activeEmployees ? Math.round((presentToday / activeEmployees) * 100) : 0,
      },
      recentRecords: recentRes.rows,
      auditLogs: auditRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// List employees
router.get('/employees', async (_req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, name, email, role, dept, designation, phone, join_date, is_active, created_at
       FROM employees
       ORDER BY created_at DESC, id ASC`
    );
    res.json({ employees: r.rows });
  } catch (err) {
    next(err);
  }
});

// Create employee
router.post('/employees', async (req, res, next) => {
  try {
    const {
      id,
      name,
      email,
      password,
      role = 'employee',
      dept = 'General',
      designation = 'Staff',
      phone = '',
      join_date = null,
    } = req.body;

    if (!id || !name || !email || !password) {
      return res.status(400).json({ error: 'id, name, email, and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const ins = await pool.query(
      `INSERT INTO employees (id, name, email, password_hash, role, dept, designation, phone, join_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
       RETURNING id, name, email, role, dept, designation, phone, join_date, is_active`,
      [
        id.trim(),
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        role,
        dept,
        designation,
        phone,
        join_date || null,
      ]
    );

    await writeAudit(req, `Created user ${id.trim()} (${role})`);
    res.status(201).json({ employee: ins.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Employee ID or email already exists' });
    }
    next(err);
  }
});

// Toggle active status
router.patch('/employees/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;
    const upd = await pool.query(
      `UPDATE employees
       SET is_active = NOT is_active
       WHERE id = $1
       RETURNING id, is_active`,
      [id]
    );
    if (upd.rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    await writeAudit(req, `Toggled active status for ${id}`);
    res.json({ employee: upd.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Delete employee
router.delete('/employees/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const del = await pool.query('DELETE FROM employees WHERE id = $1 RETURNING id', [id]);
    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    await writeAudit(req, `Deleted employee ${id}`);
    res.json({ deletedId: id });
  } catch (err) {
    next(err);
  }
});

// Get & Update Policy (supports 7-day open when weekly_off is [])
router.get('/policy', async (_req, res, next) => {
  try {
    const r = await pool.query('SELECT * FROM attendance_policies WHERE id = 1');
    const policy = r.rows[0];
    res.json({
      policy: policy
        ? { ...policy, weekly_off: Array.isArray(policy.weekly_off) ? policy.weekly_off : [] }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/policy', async (req, res, next) => {
  try {
    const {
      campus_lat,
      campus_lng,
      radius_meters,
      max_accuracy_meters,
      window_start,
      window_end,
      weekly_off = [],
    } = req.body;

    const normalizedWeeklyOff = Array.isArray(weekly_off)
      ? [...new Set(weekly_off.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(
          (a, b) => a - b
        )
      : [];

    const upd = await pool.query(
      `UPDATE attendance_policies
       SET campus_lat = $1,
           campus_lng = $2,
           radius_meters = $3,
           max_accuracy_meters = $4,
           window_start = $5,
           window_end = $6,
           weekly_off = $7,
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [
        Number(campus_lat),
        Number(campus_lng),
        Number(radius_meters),
        Number(max_accuracy_meters || 150),
        window_start,
        window_end,
        normalizedWeeklyOff, // [] means all 7 days are open
      ]
    );

    await writeAudit(
      req,
      normalizedWeeklyOff.length === 0
        ? 'Updated policy (7-day attendance open, no weekly off)'
        : `Updated policy (weekly off days: ${normalizedWeeklyOff.join(', ')})`
    );

    res.json({ policy: upd.rows[0] });
  } catch (err) {
    next(err);
  }
});

// List all holidays
router.get('/holidays', async (_req, res, next) => {
  try {
    const r = await pool.query(
      'SELECT id, holiday_date, name, description, is_working_override FROM holidays ORDER BY holiday_date ASC'
    );
    res.json({ holidays: r.rows });
  } catch (err) {
    next(err);
  }
});

// Add or update a holiday / special working day
router.post('/holidays', async (req, res, next) => {
  try {
    const { holiday_date, name, description = '', is_working_override = false } = req.body;
    if (!holiday_date || !name?.trim()) {
      return res.status(400).json({ error: 'Holiday date and name are required' });
    }

    const ins = await pool.query(
      `INSERT INTO holidays (holiday_date, name, description, is_working_override)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (holiday_date) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             is_working_override = EXCLUDED.is_working_override
       RETURNING id, holiday_date, name, description, is_working_override`,
      [holiday_date, name.trim(), description.trim(), Boolean(is_working_override)]
    );

    await writeAudit(req, `Saved holiday: ${name.trim()} (${holiday_date})`);
    res.status(201).json({ holiday: ins.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Delete a holiday
router.delete('/holidays/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const del = await pool.query('DELETE FROM holidays WHERE id = $1 RETURNING id, name', [id]);
    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'Holiday not found' });
    }
    await writeAudit(req, `Deleted holiday: ${del.rows[0].name}`);
    res.json({ deletedId: id });
  } catch (err) {
    next(err);
  }
});

export default router;