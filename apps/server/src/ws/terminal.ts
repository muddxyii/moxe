import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { agents, db, eq } from "@moxe/db";
import type { Hono } from "hono";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import { ptyManager } from "../services/pty.js";
import { claimInputOwnershipIfAlive } from "./input-ownership.js";

// Input ownership tracking
const inputOwners = new Map<string, WSContext>();

// Track unsubscribe functions per WebSocket connection
const unsubscribers = new WeakMap<WSContext, () => void>();

export function registerTerminalWs(
	app: Hono,
	upgradeWebSocket: UpgradeWebSocket,
) {
	app.get(
		"/ws/terminal/:agentId",
		upgradeWebSocket((c) => {
			const agentId = c.req.param("agentId") as string;
			return {
				async onOpen(_event, ws) {
					// 1. Validate agent
					const agent = db
						.select()
						.from(agents)
						.where(eq(agents.id, agentId))
						.get();
					if (!agent) {
						ws.send(
							JSON.stringify({ type: "error", message: "Agent not found" }),
						);
						ws.close();
						return;
					}

					// 2+3. Subscribe and buffer during file read
					const liveBuffer: string[] = [];
					const bufferUnsub = ptyManager.subscribe(agentId, (data) => {
						liveBuffer.push(data);
					});

					// 4. Backfill from log
					const logPath = agent.logPath;
					if (logPath && existsSync(logPath)) {
						try {
							const content = await readFile(logPath, "utf-8");
							if (content)
								ws.send(JSON.stringify({ type: "output", data: content }));
						} catch {
							/* continue without backfill */
						}
					}

					// 5. Flush buffered live data
					for (const chunk of liveBuffer) {
						ws.send(JSON.stringify({ type: "output", data: chunk }));
					}
					liveBuffer.length = 0;

					// 6. Replace with direct send, store unsub for cleanup
					bufferUnsub();
					const liveUnsub = ptyManager.subscribe(agentId, (data) => {
						ws.send(JSON.stringify({ type: "output", data }));
					});
					unsubscribers.set(ws, liveUnsub);

					// Input ownership
					if (!inputOwners.has(agentId)) inputOwners.set(agentId, ws);

					// 7. Status
					const instance = ptyManager.get(agentId);
					ws.send(
						JSON.stringify({
							type: "status",
							alive: instance?.alive ?? false,
							exitCode: instance?.exitCode ?? null,
						}),
					);
				},

				onMessage(event, ws) {
					const data =
						typeof event.data === "string" ? event.data : event.data.toString();
					const instance = ptyManager.get(agentId);
					if (
						claimInputOwnershipIfAlive(
							inputOwners,
							agentId,
							ws,
							instance?.alive ?? false,
						)
					) {
						ptyManager.write(agentId, data);
					}
				},

				onClose(_event, ws) {
					const unsub = unsubscribers.get(ws);
					if (unsub) {
						unsub();
						unsubscribers.delete(ws);
					}
					if (inputOwners.get(agentId) === ws) inputOwners.delete(agentId);
				},
			};
		}),
	);
}
