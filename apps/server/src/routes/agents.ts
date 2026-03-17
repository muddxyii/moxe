import { agents, db, deriveStatus, desc, eq, events } from "@moxe/db";
import { Hono } from "hono";

export const agentsRoute = new Hono();

agentsRoute.get("/", async (c) => {
	const allAgents = db.select().from(agents).all();

	const withStatus = allAgents.map((agent) => {
		const latestEvent = db
			.select()
			.from(events)
			.where(eq(events.agentId, agent.id))
			.orderBy(desc(events.ts))
			.limit(1)
			.get();

		return {
			...agent,
			status: latestEvent
				? deriveStatus(latestEvent.type as import("@moxe/db").EventType)
				: "pending",
		};
	});

	return c.json(withStatus);
});

agentsRoute.get("/:id", async (c) => {
	const agent = db
		.select()
		.from(agents)
		.where(eq(agents.id, c.req.param("id")))
		.get();

	if (!agent) return c.json({ error: "Not found" }, 404);

	const agentEvents = db
		.select()
		.from(events)
		.where(eq(events.agentId, agent.id))
		.orderBy(desc(events.ts))
		.all();

	const status = agentEvents.length
		? deriveStatus(agentEvents[0].type as import("@moxe/db").EventType)
		: "pending";

	return c.json({ ...agent, status, events: agentEvents });
});

export { agentsRoute as agents };
