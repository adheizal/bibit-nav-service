import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../schema.js";

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || "file:local.db";
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

const client: Client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

export async function initDatabase(): Promise<void> {
  console.log(`Database URL: ${TURSO_DATABASE_URL}`);
  console.log(`Auth token configured: ${TURSO_AUTH_TOKEN ? "yes" : "no (using local file)"}`);
  // Create tables if they don't exist
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS funds (
      fund_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'unknown',
      isin TEXT,
      management_company TEXT,
      manager TEXT,
      last_nav REAL,
      last_nav_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nav_history (
      fund_id TEXT NOT NULL,
      nav_date TEXT NOT NULL,
      nav REAL NOT NULL,
      PRIMARY KEY (fund_id, nav_date),
      FOREIGN KEY (fund_id) REFERENCES funds(fund_id)
    );

    CREATE TABLE IF NOT EXISTS fetch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      funds_fetched INTEGER NOT NULL DEFAULT 0,
      funds_updated INTEGER NOT NULL DEFAULT 0,
      errors INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'success',
      notes TEXT
    );
  `);
}
