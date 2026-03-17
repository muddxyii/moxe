import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export async function generatePrBody(
	worktreePath: string,
	issueNumber: number,
	baseBranch: string,
): Promise<string> {
	let commits = "";
	let diffStat = "";

	try {
		const { stdout } = await execFile(
			"git",
			["log", `${baseBranch}..HEAD`, "--oneline"],
			{ cwd: worktreePath },
		);
		commits = stdout.trim();
	} catch {
		// No commits or git error — fall through to minimal body
	}

	try {
		const { stdout } = await execFile(
			"git",
			["diff", "--stat", `${baseBranch}..HEAD`],
			{ cwd: worktreePath },
		);
		diffStat = stdout.trim();
	} catch {
		// Stat unavailable — skip
	}

	if (!commits) {
		return `Closes #${issueNumber}`;
	}

	const bullets = commits
		.split("\n")
		.filter(Boolean)
		.map((line) => `- ${line.replace(/^[a-f0-9]+ /, "")}`)
		.join("\n");

	const parts: string[] = ["## Summary", bullets];
	if (diffStat) {
		parts.push("", "## Changes", diffStat);
	}
	parts.push("", `Closes #${issueNumber}`);

	return parts.join("\n");
}

export async function createPr(
	repo: string,
	branch: string,
	issueNumber: number,
	issueTitle: string,
	body: string,
	baseBranch: string,
): Promise<{ prNumber: number; prUrl: string }> {
	const title = `Fix #${issueNumber}: ${issueTitle}`;
	const { stdout } = await execFile("gh", [
		"pr",
		"create",
		"--title",
		title,
		"--body",
		body,
		"--base",
		baseBranch,
		"--head",
		branch,
		"--repo",
		repo,
	]);

	const prUrl = stdout.trim();
	const segments = prUrl.split("/");
	const prNumber = parseInt(segments.at(-1) ?? "", 10);

	return { prNumber, prUrl };
}

export async function closeIssue(
	repo: string,
	issueNumber: number,
): Promise<void> {
	await execFile("gh", ["issue", "close", String(issueNumber), "--repo", repo]);
}
