export interface FetchResult {
    fundsFetched: number;
    fundsUpdated: number;
    errors: number;
    durationMs: number;
    status: string;
    notes: string[];
}
/**
 * Run a full fetch cycle for all known funds.
 */
export declare function runFetchCycle(): Promise<FetchResult>;
/**
 * Scan and discover new fund codes by trying RD{n} patterns.
 * This is an expensive operation, run infrequently.
 */
export declare function scanAndDiscoverFunds(start?: number, end?: number): Promise<{
    discovered: number;
    errors: number;
}>;
/**
 * Get the latest fetch log entry.
 */
export declare function getLastFetchStatus(): Promise<{
    id: number;
    fetchedAt: string;
    fundsFetched: number;
    fundsUpdated: number;
    errors: number;
    durationMs: number | null;
    status: string;
    notes: string | null;
}>;
//# sourceMappingURL=nav-fetcher.d.ts.map