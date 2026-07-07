import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./app.js";
import { initDatabase } from "./lib/db.js";
import "./cron.js"; // Initialize cron jobs

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  console.log("Initializing database...");
  await initDatabase();
  console.log("Database initialized.");

  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      console.log(`Bibit NAV Service running on http://localhost:${info.port}`);
      console.log(`Health check: http://localhost:${info.port}/api/health`);
    }
  );
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
