import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const REPOS_PATH = join(homedir(), ".moxe", "repos.json");

export interface RepoEntry {
	owner: string;
	name: string;
	localPath: string;
}

export function readRepos(): RepoEntry[] {
	try {
		return JSON.parse(readFileSync(REPOS_PATH, "utf-8"));
	} catch {
		return [];
	}
}
