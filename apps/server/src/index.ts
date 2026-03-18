import { execSync } from "node:child_process";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agents } from "./routes/agents.js";
import { issues } from "./routes/issues.js";
import { repos } from "./routes/repos.js";
import { reclaimStalePorts } from "./services/ports.js";
import { ptyManager } from "./services/pty.js";
import { registerShellWs } from "./ws/shell.js";
import { registerTerminalWs } from "./ws/terminal.js";

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", cors());
app.route("/api/agents", agents);
app.route("/api/issues", issues);
app.route("/api/repos", repos);
app.get("/api/health", (c) => c.json({ status: "ok" }));

registerTerminalWs(app, upgradeWebSocket);
registerShellWs(app, upgradeWebSocket);

try {
	const shell = process.env.SHELL || "/bin/zsh";
	execSync(`${shell} -lc 'which claude'`, { stdio: "ignore" });
} catch {
	console.warn(
		"[moxe] Warning: 'claude' not found in PATH. Install Claude Code before launching agents.",
	);
}

// Reclaim ports from previous crashed/finished agents
reclaimStalePorts().catch((err) => {
	console.warn("[moxe] Port reclaim failed:", err);
});

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
