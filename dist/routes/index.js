import { Hono } from "hono";
import { db } from "../lib/db.js";
import { funds, navHistory } from "../schema.js";
import { eq, sql, and, gte, lte, inArray } from "drizzle-orm";
import { runFetchCycle, getLastFetchStatus } from "../services/nav-fetcher.js";
import { fetchHistoricalNav } from "../lib/bibit.js";
const app = new Hono();
/**
 * GET /api/funds - List all funds with optional search/filter
 */
app.get("/api/funds", async (c) => {
    try {
        const search = c.req.query("search");
        const type = c.req.query("type");
        const page = parseInt(c.req.query("page") || "1", 10);
        const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
        const offset = (page - 1) * limit;
        const conditions = [];
        if (search) {
            conditions.push(sql `(${funds.name} LIKE ${"%" + search + "%"} OR ${funds.fundId} LIKE ${"%" + search + "%"})`);
        }
        if (type) {
            conditions.push(eq(funds.type, type));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const allFunds = whereClause
            ? await db.select().from(funds).where(whereClause).limit(limit).offset(offset).all()
            : await db.select().from(funds).limit(limit).offset(offset).all();
        const totalCount = await db.select({ count: sql `count(*)` }).from(funds);
        return c.json({
            data: allFunds,
            pagination: {
                page,
                limit,
                total: totalCount[0]?.count || 0,
                pages: Math.ceil((totalCount[0]?.count || 0) / limit),
            },
        });
    }
    catch (error) {
        console.error("Error listing funds:", error);
        return c.json({ error: "Failed to list funds" }, 500);
    }
});
/**
 * GET /api/funds/:id - Get single fund detail + latest NAV
 */
app.get("/api/funds/:id", async (c) => {
    try {
        const fundId = c.req.param("id");
        const fund = await db.select().from(funds).where(eq(funds.fundId, fundId)).get();
        if (!fund) {
            return c.json({ error: "Fund not found" }, 404);
        }
        // Get latest NAV entry
        const latestNav = await db
            .select()
            .from(navHistory)
            .where(eq(navHistory.fundId, fundId))
            .orderBy(sql `${navHistory.navDate} DESC`)
            .limit(1)
            .get();
        return c.json({
            data: {
                ...fund,
                latestNav: latestNav || null,
            },
        });
    }
    catch (error) {
        console.error("Error fetching fund:", error);
        return c.json({ error: "Failed to fetch fund" }, 500);
    }
});
/**
 * GET /api/funds/:id/nav - Get historical NAV
 * Query params: period=1M|3M|6M|1Y|3Y|5Y|ALL, from=YYYY-MM-DD, to=YYYY-MM-DD
 */
app.get("/api/funds/:id/nav", async (c) => {
    try {
        const fundId = c.req.param("id");
        const period = c.req.query("period") || "1Y";
        const fromDate = c.req.query("from");
        const toDate = c.req.query("to");
        // Validate period
        const validPeriods = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"];
        if (!validPeriods.includes(period)) {
            return c.json({ error: `Invalid period. Must be one of: ${validPeriods.join(", ")}` }, 400);
        }
        // Check if fund exists
        const fund = await db.select().from(funds).where(eq(funds.fundId, fundId)).get();
        if (!fund) {
            return c.json({ error: "Fund not found" }, 404);
        }
        // Build conditions for historical query
        const conditions = [eq(navHistory.fundId, fundId)];
        if (fromDate) {
            conditions.push(gte(navHistory.navDate, fromDate));
        }
        if (toDate) {
            conditions.push(lte(navHistory.navDate, toDate));
        }
        const whereClause = and(...conditions);
        const history = await db
            .select()
            .from(navHistory)
            .where(whereClause)
            .orderBy(sql `${navHistory.navDate} ASC`)
            .all();
        // If no data in DB, try fetching from Bibit API
        if (history.length === 0) {
            try {
                const apiHistory = await fetchHistoricalNav(fundId, period);
                // Store fetched data
                for (const point of apiHistory) {
                    try {
                        await db.insert(navHistory).values({
                            fundId,
                            navDate: point.date,
                            nav: point.nav,
                        }).onConflictDoNothing();
                    }
                    catch {
                        // Skip duplicates
                    }
                }
                // Re-query from DB
                const freshHistory = await db
                    .select()
                    .from(navHistory)
                    .where(whereClause)
                    .orderBy(sql `${navHistory.navDate} ASC`)
                    .all();
                return c.json({
                    data: freshHistory,
                    source: "bibit_api",
                    period,
                });
            }
            catch (apiError) {
                console.error("Error fetching from Bibit API:", apiError);
            }
        }
        return c.json({
            data: history,
            source: "database",
            period,
        });
    }
    catch (error) {
        console.error("Error fetching NAV history:", error);
        return c.json({ error: "Failed to fetch NAV history" }, 500);
    }
});
/**
 * GET /api/nav/latest?fund_ids=RD1653,RD1656 - Batch latest NAV
 */
app.get("/api/nav/latest", async (c) => {
    try {
        const fundIdsParam = c.req.query("fund_ids");
        if (!fundIdsParam) {
            return c.json({ error: "fund_ids query parameter required" }, 400);
        }
        const fundIds = fundIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
        if (fundIds.length === 0) {
            return c.json({ error: "No valid fund IDs provided" }, 400);
        }
        const results = await db
            .select({
            fundId: navHistory.fundId,
            navDate: navHistory.navDate,
            nav: navHistory.nav,
        })
            .from(navHistory)
            .where(inArray(navHistory.fundId, fundIds))
            .orderBy(sql `${navHistory.navDate} DESC`)
            .all();
        // Get the latest NAV for each fund
        const latestByFund = new Map();
        for (const row of results) {
            if (!latestByFund.has(row.fundId)) {
                latestByFund.set(row.fundId, { navDate: row.navDate, nav: row.nav });
            }
        }
        const data = fundIds.map((id) => ({
            fundId: id,
            ...(latestByFund.get(id) || { navDate: null, nav: null }),
        }));
        return c.json({ data });
    }
    catch (error) {
        console.error("Error fetching latest NAV:", error);
        return c.json({ error: "Failed to fetch latest NAV" }, 500);
    }
});
/**
 * GET /api/nav/compare?fund_ids=RD1653,RD1656&period=1Y - Compare funds
 */
app.get("/api/nav/compare", async (c) => {
    try {
        const fundIdsParam = c.req.query("fund_ids");
        const period = c.req.query("period") || "1Y";
        if (!fundIdsParam) {
            return c.json({ error: "fund_ids query parameter required" }, 400);
        }
        const fundIds = fundIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
        if (fundIds.length < 2) {
            return c.json({ error: "At least 2 fund IDs required for comparison" }, 400);
        }
        const results = await db
            .select()
            .from(navHistory)
            .where(inArray(navHistory.fundId, fundIds))
            .orderBy(sql `${navHistory.navDate} ASC`)
            .all();
        // Group by fund
        const byFund = new Map();
        for (const fundId of fundIds) {
            byFund.set(fundId, []);
        }
        for (const row of results) {
            const arr = byFund.get(row.fundId);
            if (arr) {
                arr.push({ date: row.navDate, nav: row.nav });
            }
        }
        return c.json({
            data: Object.fromEntries(byFund),
            period,
            fundIds,
        });
    }
    catch (error) {
        console.error("Error comparing funds:", error);
        return c.json({ error: "Failed to compare funds" }, 500);
    }
});
/**
 * GET /api/fetch/status - Last fetch status
 */
app.get("/api/fetch/status", async (c) => {
    try {
        const status = await getLastFetchStatus();
        return c.json({ data: status });
    }
    catch (error) {
        console.error("Error fetching status:", error);
        return c.json({ error: "Failed to fetch status" }, 500);
    }
});
/**
 * POST /api/fetch/trigger - Manually trigger a fetch
 */
app.post("/api/fetch/trigger", async (c) => {
    try {
        const result = await runFetchCycle();
        return c.json({
            message: "Fetch triggered successfully",
            data: result,
        });
    }
    catch (error) {
        console.error("Error triggering fetch:", error);
        return c.json({ error: "Failed to trigger fetch" }, 500);
    }
});
/**
 * Health check
 */
app.get("/api/health", (c) => {
    return c.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "bibit-nav-service",
    });
});
export default app;
//# sourceMappingURL=index.js.map