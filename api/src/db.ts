import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

const { Pool } = pg;

// Supabase (and most managed Postgres) require TLS. Enable SSL for any
// non-local host; keep it off for a local docker/postgres during dev.
function needsSsl(connectionString: string): boolean {
  if (/sslmode=disable/i.test(connectionString)) return false;
  if (/sslmode=require/i.test(connectionString)) return true;
  return !/@(localhost|127\.0\.0\.1|postgres)[:/]/i.test(connectionString);
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: needsSsl(config.databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  const sql = readFileSync(join(__dirname, 'migrations.sql'), 'utf8');
  await pool.query(sql);
}

// Idempotently create the seed agent so judges can log in immediately.
export async function seedAgent(): Promise<void> {
  const hash = await bcrypt.hash(config.agentPassword, 10);
  await pool.query(
    `INSERT INTO agents (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [config.agentEmail, hash],
  );
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as any[]);
}
