import type { EventType } from "@moxe/db";
import { agents, db, deriveStatus, desc, eq, events } from "@moxe/db";
import { Hono } from "hono";
import { killAgent, launchAgent } from "../services/lifecycle.js";

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
				? deriveStatus(latestEvent.type as EventType)
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
	const status = agentEvents[0]
		? deriveStatus(agentEvents[0].type as EventType)
		: "pending";
	return c.json({ ...agent, status, events: agentEvents });
});

agentsRoute.post("/", async (c) => {
	const body = await c.req.json<{
		repo: string;
		repoPath: string;
		issueNumber: number;
		issueTitle: string;
		issueBody?: string;
	}>();
	if (!body.repo || !body.repoPath || !body.issueNumber || !body.issueTitle) {
		return c.json(
			{ error: "repo, repoPath, issueNumber, and issueTitle are required" },
			400,
		);
	}
	const agent = await launchAgent(
		body.repo,
		body.repoPath,
		body.issueNumber,
		body.issueTitle,
		body.issueBody,
	);
	return c.json(agent, 201);
});

agentsRoute.delete("/:id", async (c) => {
	const agentId = c.req.param("id");
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
	if (!agent) return c.json({ error: "Not found" }, 404);
	await killAgent(agentId);
	return c.json({ status: "killed" });
});

export { agentsRoute as agents };
