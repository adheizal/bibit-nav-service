import cron from "node-cron";
import { runFetchCycle, scanAndDiscoverFunds } from "./services/nav-fetcher.js";
// Daily at 17:00 WIB (10:00 UTC) after Bibit updates NAV
cron.schedule("0 10 * * *", async () => {
    console.log(`[${new Date().toISOString()}] Starting scheduled NAV fetch...`);
    try {
        const result = await runFetchCycle();
        console.log(`[${new Date().toISOString()}] NAV fetch completed:`, {
            status: result.status,
            fundsFetched: result.fundsFetched,
            fundsUpdated: result.fundsUpdated,
            errors: result.errors,
            durationMs: result.durationMs,
        });
    }
    catch (error) {
        console.error(`[${new Date().toISOString()}] NAV fetch failed:`, error);
    }
});
// Weekly fund scan on Sundays at 02:00 UTC (09:00 WIB)
cron.schedule("0 2 * * 0", async () => {
    console.log(`[${new Date().toISOString()}] Starting weekly fund scan...`);
    try {
        const result = await scanAndDiscoverFunds(1, 5000);
        console.log(`[${new Date().toISOString()}] Fund scan completed:`, result);
    }
    catch (error) {
        console.error(`[${new Date().toISOString()}] Fund scan failed:`, error);
    }
});
console.log("Cron jobs scheduled:");
console.log("  - NAV fetch: daily at 17:00 WIB (10:00 UTC)");
console.log("  - Fund scan: weekly on Sunday at 09:00 WIB (02:00 UTC)");
//# sourceMappingURL=cron.js.map