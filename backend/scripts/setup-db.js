const { Pool } = require('pg');
const dotenv = require('dotenv');
const { execSync } = require('child_process');
const path = require('path');

dotenv.config();

const dbName = process.env.DB_NAME || 'verity_invetory';
const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD } = process.env;

const adminPool = new Pool({
  host: DB_HOST || '127.0.0.1',
  port: Number(DB_PORT) || 5432,
  user: DB_USER || 'postgres',
  password: DB_PASSWORD || '',
  database: 'postgres',
});

async function ensureDatabase() {
  const { rows } = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rows.length) {
    console.log(`Database "${dbName}" already exists`);
    return;
  }
  // Identifier must be quoted to be safe
  await adminPool.query(`CREATE DATABASE "${dbName}"`);
  console.log(`Database "${dbName}" created`);
}

async function main() {
  try {
    await ensureDatabase();
  } finally {
    await adminPool.end();
  }

  const scripts = [
    'run-schema.js',
    'seed-categories.js',
    'seed-users.js',
    'seed-products.js',
  ];
  for (const script of scripts) {
    const file = path.join(__dirname, script);
    console.log(`\n>>> Running ${script}`);
    execSync(`node "${file}"`, { stdio: 'inherit', cwd: __dirname });
  }
  console.log('\nSetup complete.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
