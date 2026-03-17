import { execSync } from "node:child_process";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agents } from "./routes/agents.js";
import { issues } from "./routes/issues.js";
import { ptyManager } from "./services/pty.js";
import { registerTerminalWs } from "./ws/terminal.js";

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", cors());
app.route("/api/agents", agents);
app.route("/api/issues", issues);
app.get("/api/health", (c) => c.json({ status: "ok" }));

registerTerminalWs(app, upgradeWebSocket);

try {
	execSync("which claude", { stdio: "ignore" });
} catch {
	console.warn(
		"[moxe] Warning: 'claude' not found in PATH. Install Claude Code before launching agents.",
	);
}

const port = 3456;
console.log(`Moxe server running on http://localhost:${port}`);
const server = serve({ fetch: app.fetch, port });
injectWebSocket(server);

const shutdown = async () => {
	console.log("\n[moxe] Shutting down, cleaning up PTY processes...");
	await ptyManager.shutdownAll();
	process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
