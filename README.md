# Bibit NAV Service

Layanan untuk mengambil dan menyimpan data **NAV (Net Asset Value)** reksadana Indonesia dari [Bibit](https://bibit.id). Data di-cache di [Turso](https://turso.tech) (SQLite-compatible) dan di-update otomatis setiap hari.

## Fitur

- **Fund Discovery** — Scan dan temukan reksadana yang tersedia di Bibit (RD1 - RD5000+)
- **NAV History** — Historical NAV data per fund (hingga 1 tahun ke belakang)
- **Latest NAV** — Batch query NAV terbaru untuk beberapa fund sekaligus
- **Fund Comparison** — Bandingkan performa beberapa fund dalam satu periode
- **Auto Fetch** — Cron job otomatis setiap hari jam 17:00 WIB update NAV
- **Auto Scan** — Cron job mingguan (Minggu jam 09:00 WIB) temukan fund baru
- **API Docs** — Interactive API reference pakai [Scalar](https://scalar.com)

## Base URL

| Environment | URL |
|---|---|
| Production | `https://nav-indo.manish.ltd` |
| Local | `http://localhost:3000` |

**API Docs**: `https://nav-indo.manish.ltd/api/docs`

## Tech Stack

- **Runtime**: Node.js 24 + TypeScript
- **Framework**: [Hono](https://hono.dev) (lightweight, edge-ready)
- **Database**: [Turso](https://turso.tech) via [libSQL](https://github.com/tursodatabase/libsql-client) + [Drizzle ORM](https://orm.drizzle.team)
- **Scheduler**: [node-cron](https://github.com/node-cron/node-cron) (in-process)
- **Data Source**: Bibit API (`api.bibit.id`) — AES-256-CBC encrypted responses, handled automatically

## Quick Start

### Local Development

```bash
# Clone
git clone <repo-url> && cd bibit-nav-service

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Turso credentials

# Run (with hot reload)
npm run dev

# Open API docs
open http://localhost:3000/api/docs
```

### Production (Docker)

```bash
docker build -t bibit-nav-service .
docker run -p 3000:3000 \
  -e TURSO_DATABASE_URL="libsql://your-db.turso.io" \
  -e TURSO_AUTH_TOKEN="your-token" \
  bibit-nav-service
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TURSO_DATABASE_URL` | Yes | Turso database URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Yes | Turso authentication token |
| `PORT` | No | Server port (default: `3000`) |

## API Endpoints

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |

### Funds

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/funds` | List all funds (search, filter, paginate) |
| `GET` | `/api/funds/:id` | Get fund details by symbol |

**Query Parameters** (`/api/funds`):
- `search` — Search by fund name (partial match)
- `type` — Filter by type (`saham`, `pendapatan_tetap`, `campuran`, `pasar_uang`, etc.)
- `page` — Page number (default: 1)
- `limit` — Items per page (default: 50, max: 100)

### NAV

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/funds/:id/nav` | NAV history for a fund |
| `GET` | `/api/nav/latest` | Batch latest NAV for multiple funds |
| `GET` | `/api/nav/compare` | Compare performance across funds |

**Query Parameters** (`/api/funds/:id/nav`):
- `period` — `1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, `ALL` (default: `1Y`)
- `from` / `to` — Date range (`YYYY-MM-DD`), overrides `period`

**Query Parameters** (`/api/nav/latest`):
- `fund_ids` — Comma-separated fund symbols, e.g. `RD1653,RD1656,RD1657`

### Fetch Management

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/fetch/status` | Last fetch cycle status |
| `POST` | `/api/fetch/trigger` | Manually trigger NAV fetch |
| `POST` | `/api/fetch/scan` | Scan for new funds |

**Query Parameters** (`/api/fetch/scan`):
- `start` — Starting fund number (default: 1)
- `end` — Ending fund number (default: 5000)

## Rate Limit

10 requests per minute per IP. Resets every minute.

## Cron Jobs

| Schedule | Action | Time (WIB) |
|---|---|---|
| `0 10 * * *` (UTC) | Fetch NAV for all funds | 17:00 daily |
| `0 2 * * 0` (UTC) | Scan Bibit for new funds (RD1-RD5000) | 09:00 Sunday |

Cron jobs run inside the Node.js process. They fire while the server is alive and reset on restart.

## Database Schema

```sql
-- Fund metadata
funds (fund_id, name, type, isin, management_company, manager, last_nav, last_nav_date, created_at, updated_at)

-- NAV time series
nav_history (fund_id, nav_date, nav)  -- composite PK: (fund_id, nav_date)

-- Fetch audit log
fetch_log (id, fetched_at, funds_fetched, funds_updated, errors, duration_ms, status, notes)
```

## Project Structure

```
bibit-nav-service/
├── src/
│   ├── index.ts          # Entry point
│   ├── app.ts            # Hono app, middleware (CORS, logger, rate limit)
│   ├── openapi.ts        # OpenAPI 3.0.3 spec
│   ├── docs.ts           # Scalar API Reference UI
│   ├── schema.ts         # Drizzle ORM table definitions
│   ├── cron.ts           # Scheduled jobs (daily fetch, weekly scan)
│   ├── lib/
│   │   ├── db.ts         # Turso/libSQL connection + DB init
│   │   └── bibit.ts      # Bibit API client (AES-256-CBC decryption)
│   ├── routes/
│   │   └── index.ts      # All API endpoints
│   └── services/
│       └── nav-fetcher.ts # Fetch/scan business logic
├── drizzle/
│   └── schema.sql        # SQL schema
├── drizzle.config.ts     # Drizzle Kit config
├── Dockerfile            # Multi-stage build (node:24.18.0-slim)
├── package.json
└── tsconfig.json
```

## Deploy (Northflank)

Service ini di-deploy di [Northflank](https://northflank.com) dengan domain `nav-indo.manish.ltd`. Docker image di-build dari Dockerfile dengan base image `node:24.18.0-slim` (glibc-based Debian).

Environment variables di-set di Northflank dashboard (bukan di `.env` file).

## Bibit API

Data bersumber dari `api.bibit.id`. API ini menggunakan:

- **Enkripsi**: AES-256-CBC (IV = first 16 bytes, Key = last 32 bytes UTF-8)
- **Headers**: `User-Agent`, `Origin: https://app.bibit.id`, `Referer: https://app.bibit.id/`
- **Endpoints**: `GET /products/{symbol}`, `GET /products/{symbol}/chart?period={period}`

Layanan ini menangani dekripsi dan parsing secara otomatis.
