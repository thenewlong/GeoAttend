import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './src/config/db.js';

const hash = await bcrypt.hash('123456', 10);

const res = await pool.query(
  `UPDATE employees
   SET password_hash = $1, is_active = TRUE
   WHERE id IN ('A001', 'E001')
   RETURNING id, email, role`,
  [hash]
);

console.log('Updated users:', res.rows);
await pool.end();