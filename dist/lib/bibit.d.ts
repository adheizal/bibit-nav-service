export interface BibitFundDetail {
    id: string;
    name: string;
    type?: string;
    isin?: string;
    managementCompany?: string;
    manager?: string;
    nav?: number;
    navDate?: string;
    [key: string]: unknown;
}
export interface BibitNavPoint {
    date: string;
    nav: number;
}
/**
 * Fetch fund detail from Bibit API.
 * Returns the raw decrypted data object.
 */
export declare function fetchFundDetail(symbol: string): Promise<BibitFundDetail>;
/**
 * Fetch historical NAV data from Bibit chart API.
 * Returns array of { date, nav } objects.
 */
export declare function fetchHistoricalNav(symbol: string, period?: "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL"): Promise<BibitNavPoint[]>;
/**
 * Check if a fund symbol is valid by fetching its detail.
 */
export declare function checkFundExists(symbol: string): Promise<boolean>;
//# sourceMappingURL=bibit.d.ts.map