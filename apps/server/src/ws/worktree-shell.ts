import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { agents, db, eq } from "@moxe/db";
import type { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import { ptyManager } from "../services/pty.js";

const inputOwners = new Map<string, WSContext>();
const unsubscribers = new WeakMap<WSContext, () => void>();

export function registerWorktreeShellWs(
	app: Hono,
	upgradeWebSocket: UpgradeWebSocket,
) {
	app.get(
		"/ws/worktree-shell/:agentId",
		upgradeWebSocket((c) => {
			const agentId = c.req.param("agentId") as string;
			const tabId = c.req.query("tabId");
			const sessionKey = `worktree-shell:${agentId}:${tabId ?? "default"}`;

			return {
				onOpen(_event, ws) {
					const agent = db
						.select()
						.from(agents)
						.where(eq(agents.id, agentId))
						.get();

					if (!agent?.worktreePath) {
						ws.send(
							JSON.stringify({
								type: "error",
								message: "Agent or worktree not found",
							}),
						);
						ws.close();
						return;
					}

					let instance = ptyManager.get(sessionKey);
					if (!instance || !instance.alive) {
						const shell = process.env.SHELL || "/bin/zsh";
						const logDir = join(homedir(), ".moxe", "shell-logs");
						mkdirSync(logDir, { recursive: true });
						const logPath = join(
							logDir,
							`worktree-${agentId}-${tabId ?? "default"}.log`,
						);

						try {
							instance = ptyManager.spawn(sessionKey, {
								command: shell,
								args: ["-l"],
								cwd: agent.worktreePath,
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

					const unsub = ptyManager.subscribe(sessionKey, (data) => {
						ws.send(JSON.stringify({ type: "output", data }));
					});
					unsubscribers.set(ws, unsub);

					if (!inputOwners.has(sessionKey)) inputOwners.set(sessionKey, ws);

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
					if (instance?.alive && inputOwners.get(sessionKey) === ws) {
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
