import crypto from "node:crypto";
const BASE_URL = "https://api.bibit.id";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Origin: "https://app.bibit.id",
    Referer: "https://app.bibit.id/",
    Accept: "application/json, text/plain, */*",
};
/**
 * Decrypt Bibit's encrypted response format.
 * Format: <IV-HEX><ENCRYPTED_DATA><KEY-UTF8>
 * (Legacy format had U2FsdGVkX1 prefix, now removed)
 *
 * IV: First 32 characters (hex-encoded, 16 bytes)
 * Key: Last 32 characters (UTF-8 bytes directly, 32 bytes)
 * Data: Everything between IV and Key (hex-decoded to ciphertext)
 */
function decryptBibitResponse(raw) {
    const IV_LENGTH = 32; // hex chars = 16 bytes
    const KEY_LENGTH = 32; // UTF-8 chars = 32 bytes
    // Strip legacy CryptoJS prefix if present
    let data = raw;
    if (data.startsWith("U2FsdGVkX1")) {
        data = data.slice("U2FsdGVkX1".length);
    }
    if (data.length < IV_LENGTH + KEY_LENGTH) {
        throw new Error("Invalid Bibit response: too short");
    }
    const ivHex = data.slice(0, IV_LENGTH);
    const keyStr = data.slice(-KEY_LENGTH);
    const encryptedHex = data.slice(IV_LENGTH, -KEY_LENGTH);
    const iv = Buffer.from(ivHex, "hex");
    const key = Buffer.from(keyStr, "utf-8");
    const ciphertext = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    decipher.setAutoPadding(true); // PKCS7 is default
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf-8");
}
async function fetchEncrypted(path) {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
        throw new Error(`Bibit API error: ${response.status} ${response.statusText} for ${url}`);
    }
    const text = await response.text();
    return text;
}
async function fetchDecrypted(path) {
    const raw = await fetchEncrypted(path);
    // Bibit API wraps response in JSON: {"message": "...", "data": "encrypted_string"}
    let encrypted = raw;
    try {
        const parsed = JSON.parse(raw);
        if (parsed.data && typeof parsed.data === "string") {
            encrypted = parsed.data;
        }
    }
    catch {
        // Not JSON, use raw as-is (legacy format)
    }
    const decrypted = decryptBibitResponse(encrypted);
    return JSON.parse(decrypted);
}
/**
 * Fetch fund detail from Bibit API.
 * Returns the raw decrypted data object.
 */
export async function fetchFundDetail(symbol) {
    const data = await fetchDecrypted(`/products/${symbol}`);
    // nav field may be a number (legacy) or object {date, first_date, value} (current)
    let navValue;
    let navDateStr;
    const navField = data.nav;
    if (navField && typeof navField === "object" && !Array.isArray(navField)) {
        const navObj = navField;
        navValue = navObj.value || undefined;
        navDateStr = navObj.date || undefined;
    }
    else if (typeof navField === "number") {
        navValue = navField;
    }
    // investment_manager may contain management info
    const investMgr = data.investment_manager;
    // Spread raw data first, then override with extracted values
    return {
        ...data,
        id: data.symbol || symbol,
        name: data.name || data.product_name || symbol,
        type: data.type || data.product_type || "unknown",
        isin: data.isin || undefined,
        managementCompany: data.management_company || investMgr?.name || undefined,
        manager: data.manager || investMgr?.manager || undefined,
        nav: navValue,
        navDate: navDateStr,
    };
}
/**
 * Fetch historical NAV data from Bibit chart API.
 * Returns array of { date, nav } objects.
 */
export async function fetchHistoricalNav(symbol, period = "1Y") {
    const data = await fetchDecrypted(`/products/${symbol}/chart?period=${period}`);
    // The response may be an array or an object containing an array
    let points = [];
    if (Array.isArray(data)) {
        points = data;
    }
    else if (data.data && Array.isArray(data.data)) {
        points = data.data;
    }
    else if (data.chart && Array.isArray(data.chart)) {
        points = data.chart;
    }
    return points
        .map((p) => {
        const point = p;
        // Bibit chart uses formated_date (string) or date (unix timestamp)
        let dateStr = point.formated_date || point.nav_date || "";
        if (!dateStr && typeof point.date === "number") {
            dateStr = new Date(point.date * 1000).toISOString().slice(0, 10);
        }
        return {
            date: dateStr,
            nav: point.value || point.nav || point.price || 0,
        };
    })
        .filter((p) => p.date && p.nav > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
}
/**
 * Check if a fund symbol is valid by fetching its detail.
 */
export async function checkFundExists(symbol) {
    try {
        const detail = await fetchFundDetail(symbol);
        return !!(detail.nav && detail.nav > 0);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=bibit.js.map