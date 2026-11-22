import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password are required' });
    }

    const q = await pool.query(
      `SELECT id, name, email, password_hash, role, dept, designation, phone, join_date, is_active
       FROM employees
       WHERE LOWER(email) = LOWER($1) OR LOWER(id) = LOWER($1)`,
      [identifier.trim()]
    );

    const user = q.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials or inactive account' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 30 days persistent login token
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        dept: user.dept,
        designation: user.designation,
        phone: user.phone,
        join_date: user.join_date,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Auto-login verification endpoint when user reopens web app
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const q = await pool.query(
      `SELECT id, name, email, role, dept, designation, phone, join_date, is_active
       FROM employees
       WHERE id = $1`,
      [req.user.id]
    );
    const user = q.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account inactive or not found' });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;