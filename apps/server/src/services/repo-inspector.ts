import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { RepoEntry } from "../lib/repos.js";

export type RepoInspection = {
	owner: string;
	name: string;
	localPath: string;
	alreadyRegistered: boolean;
};

export function parseGithubRepoFromRemote(
	remoteUrl: string,
): { owner: string; name: string } | null {
	const match = remoteUrl.match(
		/(?:github\.com[:/])([^/]+)\/([^/.]+?)(?:\.git)?$/,
	);
	if (!match || !match[1] || !match[2]) return null;
	return { owner: match[1], name: match[2] };
}

export function inspectRepoPath(
	localPath: string,
	existingRepos: RepoEntry[],
	pathExists: (path: string) => boolean = existsSync,
	getRemoteUrl: (path: string) => string = (path) =>
		execSync("git remote get-url origin", {
			cwd: path,
			encoding: "utf-8",
			timeout: 5000,
		}).trim(),
): RepoInspection {
	if (!localPath) {
		throw new Error("localPath is required");
	}

	if (!pathExists(localPath)) {
		throw new Error("Path does not exist");
	}

	let parsed: { owner: string; name: string } | null = null;
	try {
		parsed = parseGithubRepoFromRemote(getRemoteUrl(localPath));
	} catch {
		throw new Error("Not a git repo or no origin remote found");
	}

	if (!parsed) {
		throw new Error("Could not parse GitHub remote from origin");
	}

	const alreadyRegistered = existingRepos.some(
		(r) => r.owner === parsed.owner && r.name === parsed.name,
	);

	return {
		owner: parsed.owner,
		name: parsed.name,
		localPath,
		alreadyRegistered,
	};
}
