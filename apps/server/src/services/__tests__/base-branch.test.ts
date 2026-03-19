import { execFile as execFileCb } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { resolveBaseBranch } from "../base-branch.js";

const execFile = promisify(execFileCb);

const tempDirs: string[] = [];

async function createTempGitRepo(options: {
	config?: { baseBranch?: string };
	remoteHead?: string | null;
	localBranches?: string[];
}): Promise<string> {
	const dir = mkdtempSync(join(tmpdir(), "moxie-test-"));
	tempDirs.push(dir);

	const defaultBranch = options.localBranches?.[0] ?? "orphan";

	await execFile("git", ["init", "-b", defaultBranch, dir]);
	await execFile("git", ["config", "user.email", "test@test.com"], {
		cwd: dir,
	});
	await execFile("git", ["config", "user.name", "Test"], { cwd: dir });

	// Create initial commit
	writeFileSync(join(dir, "README"), "init");
	await execFile("git", ["add", "."], { cwd: dir });
	await execFile("git", ["commit", "-m", "init"], { cwd: dir });

	// Create additional local branches
	if (options.localBranches) {
		for (const branch of options.localBranches.slice(1)) {
			await execFile("git", ["branch", branch], { cwd: dir });
		}
	}

	// Write .moxie/config.json if provided
	if (options.config) {
		const moxieDir = join(dir, ".moxie");
		mkdirSync(moxieDir, { recursive: true });
		writeFileSync(join(moxieDir, "config.json"), JSON.stringify(options.config));
	}

	// Set up fake remote HEAD if provided
	if (options.remoteHead) {
		// Create a bare clone to act as a remote
		const remoteDir = mkdtempSync(join(tmpdir(), "moxie-remote-"));
		tempDirs.push(remoteDir);
		await execFile("git", ["clone", "--bare", dir, remoteDir]);
		await execFile("git", ["remote", "add", "origin", remoteDir], {
			cwd: dir,
		});
		await execFile("git", ["fetch", "origin"], { cwd: dir });
		// Set the symbolic ref for origin/HEAD
		await execFile(
			"git",
			[
				"symbolic-ref",
				"refs/remotes/origin/HEAD",
				`refs/remotes/origin/${options.remoteHead}`,
			],
			{ cwd: dir },
		);
	}

	return dir;
}

afterEach(() => {
	for (const dir of tempDirs) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// ignore cleanup failures
		}
	}
	tempDirs.length = 0;
});

describe("resolveBaseBranch", () => {
	it("prefers configured baseBranch from .moxie/config.json", async () => {
		const repoPath = await createTempGitRepo({
			config: { baseBranch: "develop" },
			localBranches: ["main", "master"],
		});
		const branch = await resolveBaseBranch(repoPath);
		expect(branch).toBe("develop");
	});

	it("falls back to remote HEAD branch", async () => {
		const repoPath = await createTempGitRepo({
			remoteHead: "main",
			localBranches: ["main", "master"],
		});
		const branch = await resolveBaseBranch(repoPath);
		expect(branch).toBe("main");
	});

	it('falls back to "main" if it exists locally', async () => {
		const repoPath = await createTempGitRepo({
			localBranches: ["main", "master"],
		});
		const branch = await resolveBaseBranch(repoPath);
		expect(branch).toBe("main");
	});

	it('falls back to "master" if it exists locally', async () => {
		const repoPath = await createTempGitRepo({
			localBranches: ["master"],
		});
		const branch = await resolveBaseBranch(repoPath);
		expect(branch).toBe("master");
	});

	it("throws error if no branch can be resolved", async () => {
		const repoPath = await createTempGitRepo({
			localBranches: ["develop"],
		});
		await expect(resolveBaseBranch(repoPath)).rejects.toThrow(
			/Could not resolve base branch/,
		);
	});
});
