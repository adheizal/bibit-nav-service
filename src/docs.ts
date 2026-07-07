import { Hono } from "hono";
import { spec } from "./openapi.js";

const app = new Hono();

// Serve OpenAPI spec as JSON
app.get("/api/docs/openapi.json", (c) => {
  return c.json(spec);
});

// Serve Scalar API Reference UI
app.get("/api/docs", (c) => {
  const specUrl = new URL("/api/docs/openapi.json", c.req.url).toString();

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
      overflow: hidden;
    }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="${specUrl}"
    data-theme="kepler"
    data-layout="modern"
    data-hide-download-button="false"
    data-search="true"
    data-hideModels="false"
    data-hideTestRequestButton="false"
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js"></script>
</body>
</html>`);
});

export default app;
