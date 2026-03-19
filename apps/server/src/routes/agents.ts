import { execSync } from "node:child_process";
import type { EventType } from "@moxie/db";
import { agents, db, deriveStatus, desc, eq, events } from "@moxie/db";
import { Hono } from "hono";
import { archiveAgent } from "../services/archive.js";
import { resolveBaseBranch } from "../services/base-branch.js";
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

agentsRoute.post("/:id/archive", async (c) => {
	const agentId = c.req.param("id");
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
	if (!agent) return c.json({ error: "Not found" }, 404);
	try {
		await archiveAgent(agentId);
		return c.json({ status: "archived" });
	} catch (err) {
		return c.json(
			{ error: err instanceof Error ? err.message : String(err) },
			400,
		);
	}
});

agentsRoute.get("/:id/diff", async (c) => {
	const agent = db
		.select()
		.from(agents)
		.where(eq(agents.id, c.req.param("id")))
		.get();
	if (!agent) return c.json({ error: "Not found" }, 404);
	const worktreePath = agent.worktreePath;
	if (!worktreePath) return c.json({ files: [] });

	try {
		const baseBranch = await resolveBaseBranch(agent.repoPath);
		const nameStatus = execSync(`git diff --name-status ${baseBranch}...HEAD`, {
			cwd: worktreePath,
			encoding: "utf-8",
			timeout: 10000,
		}).trim();

		if (!nameStatus) return c.json({ files: [] });

		const files = nameStatus.split("\n").map((line) => {
			const [statusChar, ...pathParts] = line.split("\t");
			const path = pathParts.join("\t");
			const statusMap: Record<string, string> = {
				A: "added",
				M: "modified",
				D: "deleted",
				R: "renamed",
			};
			const status = statusMap[statusChar?.charAt(0) ?? "M"] ?? "modified";

			let diff = "";
			try {
				diff = execSync(`git diff ${baseBranch}...HEAD -- "${path}"`, {
					cwd: worktreePath,
					encoding: "utf-8",
					timeout: 10000,
				});
			} catch {
				// file might be binary or deleted
			}

			return { path, status, diff };
		});

		return c.json({ files });
	} catch {
		return c.json({ files: [] });
	}
});

export { agentsRoute as agents };
