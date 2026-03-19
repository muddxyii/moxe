import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { REPOS_PATH, type RepoEntry, readRepos } from "../lib/repos.js";
import { inspectRepoPath } from "../services/repo-inspector.js";
import { pickDirectory } from "../services/system-picker.js";

function writeRepos(repos: RepoEntry[]) {
	const dir = join(homedir(), ".moxe");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(REPOS_PATH, JSON.stringify(repos, null, "\t"));
}

export const repos = new Hono();

repos.get("/", (c) => {
	return c.json(readRepos());
});

repos.post("/pick", async (c) => {
	try {
		const path = await pickDirectory();
		return c.json({ path });
	} catch {
		return c.json({ error: "No folder selected" }, 400);
	}
});

repos.post("/inspect", async (c) => {
	const body = await c.req.json<{ localPath: string }>();
	try {
		const details = inspectRepoPath(body.localPath, readRepos());
		return c.json(details);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to inspect repository";
		return c.json({ error: message }, 400);
	}
});

repos.post("/", async (c) => {
	const body = await c.req.json<{ localPath: string }>();
	try {
		const existing = readRepos();
		const details = inspectRepoPath(body.localPath, existing);
		if (details.alreadyRegistered) {
			return c.json({ error: "Workspace already registered" }, 409);
		}
		const entry: RepoEntry = {
			owner: details.owner,
			name: details.name,
			localPath: details.localPath,
		};
		existing.push(entry);
		writeRepos(existing);
		return c.json(entry, 201);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to inspect repository";
		if (message === "Workspace already registered") {
			return c.json({ error: message }, 409);
		}
		if (
			message === "localPath is required" ||
			message === "Path does not exist" ||
			message === "Could not parse GitHub remote from origin" ||
			message === "Not a git repo or no origin remote found"
		) {
			return c.json({ error: message }, 400);
		}
		return c.json({ error: "Failed to add workspace" }, 500);
	}
});

repos.delete("/:owner/:name", (c) => {
	const owner = c.req.param("owner");
	const name = c.req.param("name");
	const existing = readRepos();
	const filtered = existing.filter(
		(r) => !(r.owner === owner && r.name === name),
	);
	if (filtered.length === existing.length) {
		return c.json({ error: "Workspace not found" }, 404);
	}
	writeRepos(filtered);
	return c.json({ status: "deleted" });
});
