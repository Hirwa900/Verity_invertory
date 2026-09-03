const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const isRenderDatabase =
  process.env.DB_HOST && process.env.DB_HOST.includes('render.com');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'verity_inventory',

  // Render PostgreSQL requires SSL
  ssl: isRenderDatabase
    ? { rejectUnauthorized: false }
    : false,

  max: 10,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = pool;
