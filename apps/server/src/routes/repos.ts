import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";

const REPOS_PATH = join(homedir(), ".moxe", "repos.json");

interface RepoEntry {
	owner: string;
	name: string;
	localPath: string;
}

function readRepos(): RepoEntry[] {
	try {
		return JSON.parse(readFileSync(REPOS_PATH, "utf-8"));
	} catch {
		return [];
	}
}

function writeRepos(repos: RepoEntry[]) {
	const dir = join(homedir(), ".moxe");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(REPOS_PATH, JSON.stringify(repos, null, "\t"));
}

export const repos = new Hono();

repos.get("/", (c) => {
	return c.json(readRepos());
});

repos.post("/", async (c) => {
	const body = await c.req.json<{ localPath: string }>();
	if (!body.localPath) {
		return c.json({ error: "localPath is required" }, 400);
	}

	if (!existsSync(body.localPath)) {
		return c.json({ error: "Path does not exist" }, 400);
	}

	// Derive owner/name from git remote
	let owner: string;
	let name: string;
	try {
		const remoteUrl = execSync("git remote get-url origin", {
			cwd: body.localPath,
			encoding: "utf-8",
			timeout: 5000,
		}).trim();

		// Parse SSH or HTTPS remote URLs
		const match = remoteUrl.match(
			/(?:github\.com[:/])([^/]+)\/([^/.]+?)(?:\.git)?$/,
		);
		if (!match || !match[1] || !match[2]) {
			return c.json(
				{ error: "Could not parse GitHub remote from origin" },
				400,
			);
		}
		owner = match[1];
		name = match[2];
	} catch {
		return c.json({ error: "Not a git repo or no origin remote found" }, 400);
	}

	const existing = readRepos();
	const duplicate = existing.find((r) => r.owner === owner && r.name === name);
	if (duplicate) {
		return c.json({ error: "Workspace already registered" }, 409);
	}

	const entry: RepoEntry = { owner, name, localPath: body.localPath };
	existing.push(entry);
	writeRepos(existing);
	return c.json(entry, 201);
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
