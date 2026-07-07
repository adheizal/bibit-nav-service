export const spec = {
  openapi: "3.0.3",
  info: {
    title: "Bibit NAV Service",
    description: `# Bibit NAV Service

Layanan untuk mengambil dan menyimpan data **NAV (Net Asset Value)** reksadana Indonesia dari API Bibit.

Data di-cache di Turso (SQLite-compatible database) dan di-update otomatis setiap hari jam 17:00 WIB.

## Sumber Data

Semua data NAV bersumber dari **Bibit API** (\`api.bibit.id\`). API ini menggunakan enkripsi AES-256-CBC dan headers khusus. Layanan ini menangani dekripsi dan parsing secara otomatis.

## Fitur

- **Fund Discovery**: Scan dan temukan reksadana yang tersedia di Bibit (RD1 - RD5000+)
- **NAV History**: Historical NAV data per fund (hingga 1 tahun ke belakang)
- **Latest NAV**: Batch query NAV terbaru untuk beberapa fund sekaligus
- **Fund Comparison**: Bandingkan performa beberapa fund dalam satu periode
- **Auto Fetch**: Cron job otomatis setiap hari jam 17:00 WIB untuk update NAV
- **Auto Scan**: Cron job mingguan (Minggu jam 09:00 WIB) untuk menemukan fund baru

## Rate Limit

API ini menerapkan rate limit **10 requests per minute** per IP address. Rate limit di-reset setiap menit.

## Base URL

- **Production**: \`https://nav-indo.manish.ltd\`
- **Local**: \`http://localhost:3000\`

## Data Format

Semua response menggunakan format JSON. Response sukses:
\`\`\`json
{
  "data": { ... }
}
\`\`\`

Response error:
\`\`\`json
{
  "error": "Error message",
  "detail": "Technical details (optional)"
}
\`\`\``,
    version: "1.0.0",
    contact: {
      name: "Bibit NAV Service",
    },
  },
  servers: [
    {
      url: "https://nav-indo.manish.ltd",
      description: "Production",
    },
    {
      url: "http://localhost:3000",
      description: "Local Development",
    },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Check if the service is running and healthy.",
        operationId: "healthCheck",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                    service: { type: "string", example: "bibit-nav-service" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/funds": {
      get: {
        tags: ["Funds"],
        summary: "List all funds",
        description:
          "List all discovered reksadana funds with optional search and filter. Returns fund metadata including name, type, ISIN, management company, and latest NAV.",
        operationId: "listFunds",
        parameters: [
          {
            name: "search",
            in: "query",
            description: "Search funds by name (case-insensitive partial match)",
            schema: { type: "string" },
            example: "saham",
          },
          {
            name: "type",
            in: "query",
            description: "Filter by fund type",
            schema: {
              type: "string",
              enum: [
                "saham",
                "pendapatan_tetap",
                "campuran",
                "pasar_uang",
                "idx30",
                "index",
                "etf",
                "dollar",
                "campuran_aktif",
                "unknown",
              ],
            },
          },
          {
            name: "page",
            in: "query",
            description: "Page number (default: 1)",
            schema: { type: "integer", default: 1, minimum: 1 },
          },
          {
            name: "limit",
            in: "query",
            description: "Items per page (default: 50, max: 100)",
            schema: { type: "integer", default: 50, minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "List of funds",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Fund" },
                    },
                    pagination: { $ref: "#/components/schemas/Pagination" },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/funds/{id}": {
      get: {
        tags: ["Funds"],
        summary: "Get fund details",
        description:
          "Get detailed information about a specific fund by its symbol (e.g. RD1653).",
        operationId: "getFund",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Fund symbol (e.g. RD1653, RD1656)",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Fund details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/Fund" },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/funds/{id}/nav": {
      get: {
        tags: ["NAV"],
        summary: "Get NAV history",
        description:
          "Get historical NAV data for a fund. Supports period filtering and date range. If no data exists in the database, the service will automatically fetch from the Bibit API.",
        operationId: "getFundNav",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Fund symbol (e.g. RD1653)",
            schema: { type: "string" },
          },
          {
            name: "period",
            in: "query",
            description: "Time period for NAV history",
            schema: {
              type: "string",
              enum: ["1M", "3M", "6M", "1Y", "3Y", "5Y", "ALL"],
              default: "1Y",
            },
          },
          {
            name: "from",
            in: "query",
            description: "Start date (YYYY-MM-DD). Overrides period if provided.",
            schema: { type: "string", format: "date" },
          },
          {
            name: "to",
            in: "query",
            description: "End date (YYYY-MM-DD). Overrides period if provided.",
            schema: { type: "string", format: "date" },
          },
        ],
        responses: {
          "200": {
            description: "NAV history data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/NavPoint" },
                    },
                    source: {
                      type: "string",
                      enum: ["database", "bibit_api"],
                      description:
                        "Where the data came from. 'bibit_api' means data was fetched live.",
                    },
                    period: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid period parameter",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/nav/latest": {
      get: {
        tags: ["NAV"],
        summary: "Batch latest NAV",
        description:
          "Get the most recent NAV for multiple funds in a single request. Optimized for speed with individual queries per fund.",
        operationId: "getLatestNav",
        parameters: [
          {
            name: "fund_ids",
            in: "query",
            required: true,
            description: "Comma-separated list of fund symbols",
            schema: { type: "string" },
            example: "RD1653,RD1656,RD1657",
          },
        ],
        responses: {
          "200": {
            description: "Latest NAV for each fund",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          fundId: { type: "string" },
                          navDate: {
                            type: "string",
                            nullable: true,
                            description: "Date of the latest NAV (YYYY-MM-DD)",
                          },
                          nav: {
                            type: "number",
                            nullable: true,
                            description: "Latest NAV value",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/nav/compare": {
      get: {
        tags: ["NAV"],
        summary: "Compare fund performance",
        description:
          "Compare NAV history of multiple funds side-by-side. Requires at least 2 fund IDs.",
        operationId: "compareFunds",
        parameters: [
          {
            name: "fund_ids",
            in: "query",
            required: true,
            description: "Comma-separated list of fund symbols (minimum 2)",
            schema: { type: "string" },
            example: "RD1653,RD1656",
          },
          {
            name: "period",
            in: "query",
            description: "Time period for comparison",
            schema: { type: "string", default: "1Y" },
          },
        ],
        responses: {
          "200": {
            description: "Comparison data grouped by fund",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      description:
                        "Object keyed by fund symbol, each containing an array of NAV points",
                      additionalProperties: {
                        type: "array",
                        items: { $ref: "#/components/schemas/NavPoint" },
                      },
                    },
                    period: { type: "string" },
                    fundIds: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/fetch/status": {
      get: {
        tags: ["Fetch"],
        summary: "Last fetch status",
        description:
          "Get information about the last NAV fetch cycle, including how many funds were updated and any errors.",
        operationId: "getFetchStatus",
        responses: {
          "200": {
            description: "Last fetch status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: "#/components/schemas/FetchLog" },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/fetch/trigger": {
      post: {
        tags: ["Fetch"],
        summary: "Trigger NAV fetch",
        description:
          "Manually trigger a NAV fetch cycle. This will update NAV data for all funds currently in the database. Runs asynchronously and returns the result when complete.",
        operationId: "triggerFetch",
        responses: {
          "200": {
            description: "Fetch completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    data: { $ref: "#/components/schemas/FetchResult" },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/api/fetch/scan": {
      post: {
        tags: ["Fetch"],
        summary: "Scan for new funds",
        description:
          "Scan Bibit API to discover new reksadana funds. By default scans RD1 to RD5000. Each fund symbol is tested individually with the Bibit API.",
        operationId: "scanFunds",
        parameters: [
          {
            name: "start",
            in: "query",
            description: "Starting fund number to scan (default: 1)",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "end",
            in: "query",
            description: "Ending fund number to scan (default: 5000)",
            schema: { type: "integer", default: 5000 },
          },
        ],
        responses: {
          "200": {
            description: "Scan completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    data: {
                      type: "object",
                      properties: {
                        discovered: {
                          type: "integer",
                          description: "Number of new funds discovered",
                        },
                        errors: {
                          type: "integer",
                          description: "Number of errors during scan",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
  },
  components: {
    schemas: {
      Fund: {
        type: "object",
        properties: {
          fundId: {
            type: "string",
            description: "Fund symbol (e.g. RD1653)",
            example: "RD1653",
          },
          name: {
            type: "string",
            description: "Full fund name",
            example: "Sucorinvest Equity Fund",
          },
          type: {
            type: "string",
            description: "Fund type/category",
            example: "saham",
          },
          isin: {
            type: "string",
            nullable: true,
            description: "International Securities Identification Number",
          },
          managementCompany: {
            type: "string",
            nullable: true,
            description: "Fund management company",
          },
          manager: {
            type: "string",
            nullable: true,
            description: "Fund manager name",
          },
          lastNav: {
            type: "number",
            nullable: true,
            description: "Most recent NAV value",
            example: 2520.94,
          },
          lastNavDate: {
            type: "string",
            nullable: true,
            description: "Date of most recent NAV (YYYY-MM-DD)",
            example: "2026-07-04",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      NavPoint: {
        type: "object",
        properties: {
          fundId: { type: "string", example: "RD1653" },
          navDate: { type: "string", example: "2026-07-04" },
          nav: { type: "number", example: 2520.94 },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      FetchLog: {
        type: "object",
        properties: {
          id: { type: "integer" },
          fetchedAt: { type: "string", format: "date-time" },
          fundsFetched: { type: "integer" },
          fundsUpdated: { type: "integer" },
          errors: { type: "integer" },
          durationMs: { type: "integer" },
          status: { type: "string", enum: ["success", "partial", "error"] },
          notes: { type: "string", nullable: true },
        },
      },
      FetchResult: {
        type: "object",
        properties: {
          fundsFetched: { type: "integer" },
          fundsUpdated: { type: "integer" },
          errors: { type: "integer" },
          durationMs: { type: "integer" },
          status: { type: "string" },
          notes: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", description: "Error message" },
          detail: {
            type: "string",
            nullable: true,
            description: "Technical details",
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: "Bad request - missing or invalid parameters",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      InternalError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
};
