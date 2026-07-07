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
