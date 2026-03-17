import { execSync } from "node:child_process";
import { Hono } from "hono";

export const issues = new Hono();

issues.get("/", async (c) => {
	const repo = c.req.query("repo");
	if (!repo) return c.json({ error: "repo query param required" }, 400);

	try {
		const result = execSync(
			`gh issue list --repo ${repo} --state open --json number,title,body,labels --limit 50`,
			{ encoding: "utf-8", timeout: 15000 },
		);
		return c.json(JSON.parse(result));
	} catch {
		return c.json(
			{
				error: "Failed to fetch issues. Is gh CLI installed and authenticated?",
			},
			500,
		);
	}
});
