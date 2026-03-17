import { execFile as execFileCb } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 30);
}

export function resolvePaths(
	issueNumber: number,
	issueTitle: string,
	agentId: string,
): { worktreePath: string; branch: string; logPath: string } {
	const slug = slugify(issueTitle);
	const prefix = agentId.slice(0, 7);
	const branch = `feature/issue-${issueNumber}-${slug}-${prefix}`;
	const worktreePath = join(
		homedir(),
		".moxe",
		"worktrees",
		`issue-${issueNumber}-${slug}-${prefix}`,
	);
	const logPath = join(worktreePath, "agent.log");
	return { worktreePath, branch, logPath };
}

export async function createWorktree(
	repoPath: string,
	issueNumber: number,
	issueTitle: string,
	agentId: string,
): Promise<{ worktreePath: string; branch: string; logPath: string }> {
	const paths = resolvePaths(issueNumber, issueTitle, agentId);
	await execFile(
		"git",
		["worktree", "add", "-b", paths.branch, paths.worktreePath, "HEAD"],
		{ cwd: repoPath },
	);
	return paths;
}

export async function removeWorktree(
	repoPath: string,
	worktreePath: string,
	branch: string,
	keepBranch = true,
): Promise<void> {
	try {
		await execFile("git", ["worktree", "remove", "--force", worktreePath], {
			cwd: repoPath,
		});
	} catch {
		// Already gone — idempotent
	}

	if (!keepBranch) {
		try {
			await execFile("git", ["branch", "-D", branch], { cwd: repoPath });
		} catch {
			// Already gone — idempotent
		}
	}
}
