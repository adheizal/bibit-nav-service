import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const funds = sqliteTable("funds", {
  fundId: text("fund_id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("unknown"),
  isin: text("isin"),
  managementCompany: text("management_company"),
  manager: text("manager"),
  lastNav: real("last_nav"),
  lastNavDate: text("last_nav_date"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const navHistory = sqliteTable("nav_history", {
  fundId: text("fund_id").notNull(),
  navDate: text("nav_date").notNull(),
  nav: real("nav").notNull(),
});

export const fetchLog = sqliteTable("fetch_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fetchedAt: text("fetched_at").notNull().default("(datetime('now'))"),
  fundsFetched: integer("funds_fetched").notNull().default(0),
  fundsUpdated: integer("funds_updated").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  durationMs: integer("duration_ms"),
  status: text("status").notNull().default("success"),
  notes: text("notes"),
});
