const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const run = async () => {
  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    const { rows } = await client.query("SELECT id FROM schema_migrations WHERE name = 'schema'");
    if (!rows.length) {
      await client.query(schemaSql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ('schema')");
      console.log('Schema applied successfully');
    } else {
      console.log('Schema already applied, skipping');
    }
    await client.query('COMMIT');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Schema error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
};

run();
