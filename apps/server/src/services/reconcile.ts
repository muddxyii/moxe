import { agents, db } from "@moxie/db";
import { appendEvent, getLatestEvent } from "./events.js";

export async function reconcileStaleAgents(): Promise<void> {
	const allAgents = db.select().from(agents).all();

	for (const agent of allAgents) {
		const latest = await getLatestEvent(agent.id);
		if (!latest) continue;

		// Determine if this agent is in a "live process expected" state
		const failEvent =
			latest.type === "agent_start"
				? "agent_failed"
				: latest.type === "init_start" || latest.type === "init_done"
					? "init_failed"
					: null;

		if (!failEvent) continue;

		// Check if the process is still alive
		const pid = agent.pid;
		let processAlive = false;

		if (pid !== null) {
			try {
				process.kill(pid, 0);
				processAlive = true;
			} catch {
				// ESRCH — process does not exist
				processAlive = false;
			}
		}

		if (!processAlive) {
			await appendEvent(agent.id, failEvent, { reason: "server_restart" });
			console.log(
				`[moxie] Marked agent ${agent.id} as failed (PID ${pid ?? "null"} not found after server restart)`,
			);
		}
	}
}
