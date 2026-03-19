import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
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
				async onOpen(_event, ws) {
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

					// Compute log path (needed for both spawn and backfill)
					const logDir = join(homedir(), ".moxie", "shell-logs");
					mkdirSync(logDir, { recursive: true });
					const logPath = join(
						logDir,
						`${owner}-${name}${tabId ? `-${tabId}` : ""}.log`,
					);

					// Spawn shell if not already running
					let instance = ptyManager.get(sessionKey);
					if (!instance || !instance.alive) {
						const shell = process.env.SHELL || "/bin/zsh";

						// Use stored CWD if available, fall back to repo.localPath
						const stored = sessionStore.get(sessionKey);
						const cwd = stored?.cwd ?? repo.localPath;

						try {
							instance = ptyManager.spawn(sessionKey, {
								command: shell,
								args: ["-l"],
								cwd,
								env: {
									...process.env,
									TERM: "xterm-color",
									PROMPT_EOL_MARK: "",
								},
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

					// Subscribe and buffer live output during backfill
					const liveBuffer: string[] = [];
					const bufferUnsub = ptyManager.subscribe(sessionKey, (data) => {
						liveBuffer.push(data);
					});

					// Backfill from log file
					if (existsSync(logPath)) {
						try {
							const content = await readFile(logPath, "utf-8");
							if (content)
								ws.send(JSON.stringify({ type: "output", data: content }));
						} catch {
							/* continue without backfill */
						}
					}

					// Flush buffered live data
					for (const chunk of liveBuffer) {
						ws.send(JSON.stringify({ type: "output", data: chunk }));
					}
					liveBuffer.length = 0;

					// Replace buffer with direct passthrough
					bufferUnsub();
					const liveUnsub = ptyManager.subscribe(sessionKey, (data) => {
						ws.send(JSON.stringify({ type: "output", data }));
					});
					unsubscribers.set(ws, liveUnsub);

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
					const raw =
						typeof event.data === "string" ? event.data : event.data.toString();

					try {
						const msg = JSON.parse(raw);
						if (
							msg.type === "resize" &&
							typeof msg.cols === "number" &&
							typeof msg.rows === "number"
						) {
							ptyManager.resize(sessionKey, msg.cols, msg.rows);
							return;
						}
					} catch {
						// Not JSON — treat as raw terminal input
					}

					const instance = ptyManager.get(sessionKey);
					if (
						claimInputOwnershipIfAlive(
							inputOwners,
							sessionKey,
							ws,
							instance?.alive ?? false,
						)
					) {
						ptyManager.write(sessionKey, raw);
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
