import crypto from "node:crypto";

const BASE_URL = "https://api.bibit.id";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Origin: "https://app.bibit.id",
  Referer: "https://app.bibit.id/",
  Accept: "application/json, text/plain, */*",
};

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
 * Decrypt Bibit's encrypted response format.
 * Format: <IV-HEX><ENCRYPTED_DATA><KEY-UTF8>
 * (Legacy format had U2FsdGVkX1 prefix, now removed)
 *
 * IV: First 32 characters (hex-encoded, 16 bytes)
 * Key: Last 32 characters (UTF-8 bytes directly, 32 bytes)
 * Data: Everything between IV and Key (hex-decoded to ciphertext)
 */
function decryptBibitResponse(raw: string): string {
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

async function fetchEncrypted(path: string): Promise<string> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) {
    throw new Error(`Bibit API error: ${response.status} ${response.statusText} for ${url}`);
  }

  const text = await response.text();
  return text;
}

async function fetchDecrypted<T>(path: string): Promise<T> {
  const raw = await fetchEncrypted(path);

  // Bibit API wraps response in JSON: {"message": "...", "data": "encrypted_string"}
  let encrypted = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.data && typeof parsed.data === "string") {
      encrypted = parsed.data;
    }
  } catch {
    // Not JSON, use raw as-is (legacy format)
  }

  const decrypted = decryptBibitResponse(encrypted);
  return JSON.parse(decrypted) as T;
}

/**
 * Fetch fund detail from Bibit API.
 * Returns the raw decrypted data object.
 */
export async function fetchFundDetail(symbol: string): Promise<BibitFundDetail> {
  const data = await fetchDecrypted<Record<string, unknown>>(`/products/${symbol}`);

  // nav field may be a number (legacy) or object {date, first_date, value} (current)
  let navValue: number | undefined;
  let navDateStr: string | undefined;
  const navField = data.nav;
  if (navField && typeof navField === "object" && !Array.isArray(navField)) {
    const navObj = navField as Record<string, unknown>;
    navValue = (navObj.value as number) || undefined;
    navDateStr = (navObj.date as string) || undefined;
  } else if (typeof navField === "number") {
    navValue = navField;
  }

  // investment_manager may contain management info
  const investMgr = data.investment_manager as Record<string, unknown> | undefined;

  // Spread raw data first, then override with extracted values
  return {
    ...data,
    id: (data.symbol as string) || symbol,
    name: (data.name as string) || (data.product_name as string) || symbol,
    type: (data.type as string) || (data.product_type as string) || "unknown",
    isin: (data.isin as string) || undefined,
    managementCompany: (data.management_company as string) || (investMgr?.name as string) || undefined,
    manager: (data.manager as string) || (investMgr?.manager as string) || undefined,
    nav: navValue,
    navDate: navDateStr,
  } as BibitFundDetail;
}

/**
 * Fetch historical NAV data from Bibit chart API.
 * Returns array of { date, nav } objects.
 */
export async function fetchHistoricalNav(
  symbol: string,
  period: "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "ALL" = "1Y"
): Promise<BibitNavPoint[]> {
  const data = await fetchDecrypted<Record<string, unknown>>(
    `/products/${symbol}/chart?period=${period}`
  );

  // The response may be an array or an object containing an array
  let points: unknown[] = [];

  if (Array.isArray(data)) {
    points = data;
  } else if (data.data && Array.isArray(data.data)) {
    points = data.data as unknown[];
  } else if (data.chart && Array.isArray(data.chart)) {
    points = data.chart as unknown[];
  }

  return points
    .map((p: unknown) => {
      const point = p as Record<string, unknown>;
      // Bibit chart uses formated_date (string) or date (unix timestamp)
      let dateStr = (point.formated_date as string) || (point.nav_date as string) || "";
      if (!dateStr && typeof point.date === "number") {
        dateStr = new Date(point.date * 1000).toISOString().slice(0, 10);
      }
      return {
        date: dateStr,
        nav: (point.value as number) || (point.nav as number) || (point.price as number) || 0,
      };
    })
    .filter((p) => p.date && p.nav > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Check if a fund symbol is valid by fetching its detail.
 */
export async function checkFundExists(symbol: string): Promise<boolean> {
  try {
    const detail = await fetchFundDetail(symbol);
    return !!(detail.nav && detail.nav > 0);
  } catch {
    return false;
  }
}
