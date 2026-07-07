import { db } from "../lib/db.js";
import { funds, navHistory, fetchLog } from "../schema.js";
import { fetchFundDetail, fetchHistoricalNav } from "../lib/bibit.js";
import { eq, sql } from "drizzle-orm";

export interface FetchResult {
  fundsFetched: number;
  fundsUpdated: number;
  errors: number;
  durationMs: number;
  status: string;
  notes: string[];
}

/**
 * Fetch NAV data for a single fund.
 * Returns true if the fund was updated.
 */
async function fetchSingleFund(fundId: string): Promise<boolean> {
  try {
    const detail = await fetchFundDetail(fundId);

    if (!detail.nav || detail.nav <= 0) {
      return false;
    }

    // Upsert fund record
    const existingFund = await db
      .select()
      .from(funds)
      .where(eq(funds.fundId, fundId))
      .get();

    if (existingFund) {
      await db
        .update(funds)
        .set({
          lastNav: detail.nav,
          lastNavDate: detail.navDate,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(funds.fundId, fundId));
    } else {
      await db.insert(funds).values({
        fundId,
        name: detail.name,
        type: detail.type || "unknown",
        isin: detail.isin,
        managementCompany: detail.managementCompany,
        manager: detail.manager,
        lastNav: detail.nav,
        lastNavDate: detail.navDate,
      });
    }

    return true;
  } catch (error) {
    console.error(`Error fetching fund ${fundId}:`, error);
    return false;
  }
}

/**
 * Fetch historical NAV for a fund and store it.
 */
async function fetchAndStoreHistory(
  fundId: string,
  period: "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL" = "1Y"
): Promise<number> {
  try {
    const history = await fetchHistoricalNav(fundId, period);

    let inserted = 0;
    for (const point of history) {
      try {
        await db
          .insert(navHistory)
          .values({
            fundId,
            navDate: point.date,
            nav: point.nav,
          })
          .onConflictDoNothing();
        inserted++;
      } catch {
        // Skip duplicate entries
      }
    }

    return inserted;
  } catch (error) {
    console.error(`Error fetching history for ${fundId}:`, error);
    return 0;
  }
}

/**
 * Run a full fetch cycle for all known funds.
 */
export async function runFetchCycle(): Promise<FetchResult> {
  const startTime = Date.now();
  const notes: string[] = [];
  let fundsFetched = 0;
  let fundsUpdated = 0;
  let errors = 0;

  try {
    // Get all known funds
    const allFunds = await db.select().from(funds).all();
    notes.push(`Found ${allFunds.length} funds in database`);

    for (const fund of allFunds) {
      try {
        const updated = await fetchSingleFund(fund.fundId);
        fundsFetched++;
        if (updated) {
          fundsUpdated++;
          // Also fetch recent history
          await fetchAndStoreHistory(fund.fundId, "1Y");
        }
        // Small delay to be nice to Bibit API
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {
        errors++;
        notes.push(`Error fetching ${fund.fundId}`);
      }
    }
  } catch (error) {
    errors++;
    notes.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const durationMs = Date.now() - startTime;
  const status = errors > 0 ? (fundsUpdated > 0 ? "partial" : "error") : "success";

  // Log the fetch cycle
  await db.insert(fetchLog).values({
    fundsFetched,
    fundsUpdated,
    errors,
    durationMs,
    status,
    notes: notes.join("; "),
  });

  return {
    fundsFetched,
    fundsUpdated,
    errors,
    durationMs,
    status,
    notes,
  };
}

/**
 * Scan and discover new fund codes by trying RD{n} patterns.
 * This is an expensive operation, run infrequently.
 */
export async function scanAndDiscoverFunds(
  start: number = 1,
  end: number = 5000
): Promise<{ discovered: number; errors: number }> {
  let discovered = 0;
  let errors = 0;

  for (let i = start; i <= end; i++) {
    const symbol = `RD${i}`;
    try {
      const exists = await fetchSingleFund(symbol);
      if (exists) {
        discovered++;
        console.log(`Discovered fund: ${symbol}`);
      }
      // Rate limit: wait between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      errors++;
    }
  }

  return { discovered, errors };
}

/**
 * Get the latest fetch log entry.
 */
export async function getLastFetchStatus() {
  const entries = await db
    .select()
    .from(fetchLog)
    .orderBy(sql`${fetchLog.id} DESC`)
    .limit(1)
    .all();

  return entries[0] || null;
}
