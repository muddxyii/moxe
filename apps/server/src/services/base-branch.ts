import { execFile as execFileCb } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

interface RepoMoxeConfig {
	baseBranch?: string;
}

function readRepoConfig(repoPath: string): RepoMoxeConfig {
	try {
		const text = readFileSync(join(repoPath, ".moxe", "config.json"), "utf-8");
		const raw = JSON.parse(text) as Record<string, unknown>;
		return {
			baseBranch:
				typeof raw.baseBranch === "string" ? raw.baseBranch : undefined,
		};
	} catch {
		return {};
	}
}

async function readRemoteHeadBranch(repoPath: string): Promise<string | null> {
	try {
		const { stdout } = await execFile(
			"git",
			["symbolic-ref", "refs/remotes/origin/HEAD"],
			{ cwd: repoPath },
		);
		// stdout looks like "refs/remotes/origin/main\n"
		const ref = stdout.trim();
		const prefix = "refs/remotes/origin/";
		if (ref.startsWith(prefix)) {
			return ref.slice(prefix.length);
		}
		return null;
	} catch {
		return null;
	}
}

async function hasLocalBranch(
	repoPath: string,
	name: string,
): Promise<boolean> {
	try {
		await execFile(
			"git",
			["show-ref", "--verify", "--quiet", `refs/heads/${name}`],
			{ cwd: repoPath },
		);
		return true;
	} catch {
		return false;
	}
}

export async function resolveBaseBranch(repoPath: string): Promise<string> {
	const configured = readRepoConfig(repoPath).baseBranch;
	if (configured) return configured;

	const remoteHead = await readRemoteHeadBranch(repoPath);
	if (remoteHead) return remoteHead;

	if (await hasLocalBranch(repoPath, "main")) return "main";
	if (await hasLocalBranch(repoPath, "master")) return "master";

	throw new Error(`Could not resolve base branch for ${repoPath}`);
}
