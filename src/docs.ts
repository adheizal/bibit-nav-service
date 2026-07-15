import { Hono } from "hono";
import { spec } from "./openapi.js";

const app = new Hono();

// Serve OpenAPI spec as JSON
app.get("/api/docs/openapi.json", (c) => {
  return c.json(spec);
});

// Serve Scalar API Reference UI (spec inlined to avoid CORS/fetch issues)
app.get("/api/docs", (c) => {
  const specJson = JSON.stringify(spec);

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bibit NAV Service - API Reference</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
    }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-theme="kepler"
    data-layout="modern"
    data-hide-download-button="false"
    data-search="true"
    data-hide-models="false"
    data-hide-test-request-button="false"
  >${specJson}</script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js"></script>
</body>
</html>`);
});

export default app;
