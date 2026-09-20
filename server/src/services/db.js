import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.supabaseDbUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function initDatabase() {
  if (!config.supabaseDbUrl) throw new Error('SUPABASE_DB_URL is required.');
  await pool.query('SELECT 1');
}

export async function closeDatabase() {
  await pool.end();
}
