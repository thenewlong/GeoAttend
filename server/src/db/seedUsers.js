import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

async function seedUsers() {
  const hash = await bcrypt.hash('123456', 10);

  await pool.query(
    `INSERT INTO employees (id, name, email, password_hash, role, dept, designation, join_date, is_active)
     VALUES
       ('A001', 'Administrator', 'admin@geoattend.demo', $1, 'admin', 'Admin', 'System Admin', '2020-01-01', TRUE),
       ('E001', 'Dr. A. Sen', 'employee@geoattend.demo', $1, 'employee', 'Training', 'Scientist C', '2019-07-01', TRUE)
     ON CONFLICT (id) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           is_active = TRUE`,
    [hash]
  );

  console.log('Users seeded with password: 123456');
  await pool.end();
}

seedUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});