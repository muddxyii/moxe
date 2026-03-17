import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agents } from "./routes/agents.js";
import { issues } from "./routes/issues.js";

const app = new Hono();

app.use("*", cors());

app.route("/api/agents", agents);
app.route("/api/issues", issues);

app.get("/api/health", (c) => c.json({ status: "ok" }));

const port = 3456;
console.log(`Moxe server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
