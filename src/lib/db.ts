import { sql } from '@vercel/postgres';

export async function initializeDatabase(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      default_order INTEGER NOT NULL DEFAULT 10,
      shelf_life INTEGER NOT NULL DEFAULT 1,
      is_deli_item BOOLEAN NOT NULL DEFAULT false,
      delivery_slot_count INTEGER NOT NULL DEFAULT 1,
      over_order_tolerance INTEGER NOT NULL DEFAULT 2,
      under_order_tolerance INTEGER NOT NULL DEFAULT 1,
      has_order_correction_period BOOLEAN NOT NULL DEFAULT false,
      correction_deadline_hour INTEGER NOT NULL DEFAULT 10,
      price INTEGER,
      cost INTEGER,
      markdown_rules JSONB NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sales_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      product_id TEXT NOT NULL,
      sold INTEGER NOT NULL DEFAULT 0,
      wasted INTEGER NOT NULL DEFAULT 0,
      stockout INTEGER NOT NULL DEFAULT 0,
      ordered INTEGER NOT NULL DEFAULT 0,
      marked_down INTEGER NOT NULL DEFAULT 0,
      markdown_amount INTEGER NOT NULL DEFAULT 0,
      weather TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sale_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vacation_periods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      reduction_pct INTEGER NOT NULL DEFAULT 15,
      note TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS academic_calendar (
      academic_year INTEGER PRIMARY KEY,
      fetched_at TEXT,
      source_url TEXT NOT NULL,
      periods JSONB NOT NULL DEFAULT '[]'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      weather_sunny REAL NOT NULL DEFAULT 1.05,
      weather_cloudy REAL NOT NULL DEFAULT 1.00,
      weather_rainy REAL NOT NULL DEFAULT 0.85,
      weather_snowy REAL NOT NULL DEFAULT 0.75,
      event_factor REAL NOT NULL DEFAULT 1.25,
      sale_factor REAL NOT NULL DEFAULT 1.20,
      holiday_factor REAL NOT NULL DEFAULT 0.80
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
      created_at TEXT NOT NULL
    )
  `;
}

let _dbInitPromise: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (!_dbInitPromise) {
    _dbInitPromise = initializeDatabase();
  }
  return _dbInitPromise;
}
