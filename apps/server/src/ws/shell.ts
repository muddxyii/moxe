import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import { readRepos } from "../lib/repos.js";
import { ptyManager } from "../services/pty.js";
import { sessionStore } from "../services/session-store.js";
import { claimInputOwnershipIfAlive } from "./input-ownership.js";

const inputOwners = new Map<string, WSContext>();
const unsubscribers = new WeakMap<WSContext, () => void>();

export function registerShellWs(app: Hono, upgradeWebSocket: UpgradeWebSocket) {
	app.get(
		"/ws/shell/:owner/:name",
		upgradeWebSocket((c) => {
			const owner = c.req.param("owner") as string;
			const name = c.req.param("name") as string;
			const tabId = c.req.query("tabId");
			const sessionKey = tabId
				? `shell:${owner}/${name}:${tabId}`
				: `shell:${owner}/${name}`;

			return {
				onOpen(_event, ws) {
					// Find the registered repo
					const repos = readRepos();
					const repo = repos.find((r) => r.owner === owner && r.name === name);
					if (!repo) {
						ws.send(
							JSON.stringify({ type: "error", message: "Workspace not found" }),
						);
						ws.close();
						return;
					}

					// Spawn shell if not already running
					let instance = ptyManager.get(sessionKey);
					if (!instance || !instance.alive) {
						const shell = process.env.SHELL || "/bin/zsh";
						const logDir = join(homedir(), ".moxe", "shell-logs");
						mkdirSync(logDir, { recursive: true });
						const logPath = join(
							logDir,
							`${owner}-${name}${tabId ? `-${tabId}` : ""}.log`,
						);

						// Use stored CWD if available, fall back to repo.localPath
						const stored = sessionStore.get(sessionKey);
						const cwd = stored?.cwd ?? repo.localPath;

						try {
							instance = ptyManager.spawn(sessionKey, {
								command: shell,
								args: ["-l"],
								cwd,
								env: { ...process.env, TERM: "xterm-color" },
								logPath,
							});
						} catch (err) {
							ws.send(
								JSON.stringify({
									type: "error",
									message: `Failed to spawn shell: ${err}`,
								}),
							);
							ws.close();
							return;
						}
					}

					// Subscribe to live output
					const unsub = ptyManager.subscribe(sessionKey, (data) => {
						ws.send(JSON.stringify({ type: "output", data }));
					});
					unsubscribers.set(ws, unsub);

					// Input ownership
					if (!inputOwners.has(sessionKey)) inputOwners.set(sessionKey, ws);

					// Send current status
					ws.send(
						JSON.stringify({
							type: "status",
							alive: instance.alive,
							exitCode: instance.exitCode,
						}),
					);
				},

				onMessage(event, ws) {
					const data =
						typeof event.data === "string" ? event.data : event.data.toString();
					const instance = ptyManager.get(sessionKey);
					if (
						claimInputOwnershipIfAlive(
							inputOwners,
							sessionKey,
							ws,
							instance?.alive ?? false,
						)
					) {
						ptyManager.write(sessionKey, data);
					}
				},

				onClose(_event, ws) {
					const unsub = unsubscribers.get(ws);
					if (unsub) {
						unsub();
						unsubscribers.delete(ws);
					}
					if (inputOwners.get(sessionKey) === ws)
						inputOwners.delete(sessionKey);
				},
			};
		}),
	);
}
