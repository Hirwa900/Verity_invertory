const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

const users = [
  { name: 'Admin User', email: 'admin@verity.local', password: 'admin123', role: 'admin' },
  { name: 'Benis Shirma', email: 'benishirwa@gmail.com', password: 'admin123', role: 'admin' },
];

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of users) {
      const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (rows.length) {
        console.log(`Skipped existing user: ${u.email}`);
        continue;
      }
      const passwordHash = await bcrypt.hash(u.password, 10);
      const result = await client.query(
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [u.name, u.email, passwordHash, u.role, true]
      );
      console.log(`Inserted user: ${u.email} (id=${result.rows[0].id}, password=${u.password})`);
    }
    await client.query('COMMIT');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
  }
};

run();
