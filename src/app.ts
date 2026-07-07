import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import routes from "./routes/index.js";
import docs from "./docs.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Rate limiting middleware (10 RPM per IP)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

app.use("*", async (c, next) => {
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window

  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
  } else {
    entry.count++;
    if (entry.count > 10) {
      return c.json(
        { error: "Rate limit exceeded. Maximum 10 requests per minute." },
        429
      );
    }
  }

  await next();
});

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 60 * 1000);

// Mount routes
app.route("/", routes);
app.route("/", docs);

// Root redirect
app.get("/", (c) => {
  return c.redirect("/api/docs");
});

export default app;
