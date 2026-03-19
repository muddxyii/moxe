import type { AgentStatus, EventType } from "@moxie/db";
import { asc, db, deriveStatus, desc, eq, events, nanoid } from "@moxie/db";

export async function appendEvent(
	agentId: string,
	type: EventType,
	payload?: Record<string, unknown>,
): Promise<void> {
	db.insert(events)
		.values({
			id: nanoid(),
			agentId,
			type,
			payload: payload ? JSON.stringify(payload) : null,
			ts: new Date().toISOString(),
		})
		.run();
}

export async function getLatestEvent(agentId: string) {
	return db
		.select()
		.from(events)
		.where(eq(events.agentId, agentId))
		.orderBy(desc(events.ts))
		.limit(1)
		.get();
}

export async function getStatus(agentId: string): Promise<AgentStatus> {
	const latest = await getLatestEvent(agentId);
	if (!latest) return "pending";
	return deriveStatus(latest.type as EventType);
}

export async function getEvents(agentId: string) {
	return db
		.select()
		.from(events)
		.where(eq(events.agentId, agentId))
		.orderBy(asc(events.ts))
		.all();
}
