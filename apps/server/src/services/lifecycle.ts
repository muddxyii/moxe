import { readFileSync } from "node:fs";
import { join } from "node:path";
import { agents, db, eq, nanoid } from "@moxe/db";
import { appendEvent } from "./events.js";
import { ptyManager } from "./pty.js";
import { createWorktree, removeWorktree, resolvePaths } from "./worktree.js";

function readConfig(repoPath: string): { command: string; args: string[] } {
	try {
		const raw = readFileSync(join(repoPath, ".moxe", "config.json"), "utf-8");
		const parsed = JSON.parse(raw) as { command?: string; args?: string[] };
		return {
			command: parsed.command ?? "claude",
			args: parsed.args ?? ["-p"],
		};
	} catch {
		return { command: "claude", args: ["-p"] };
	}
}

function buildPrompt(issueTitle: string, issueBody?: string | null): string {
	const body = issueBody ? `\n\n${issueBody}` : "";
	return `Fix the following GitHub issue:\n\nTitle: ${issueTitle}${body}`;
}

async function teardown(agentId: string): Promise<void> {
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
	if (!agent) return;

	await appendEvent(agentId, "teardown_start");

	ptyManager.cleanup(agentId);

	// Phase 6 insertion point: run teardown.sh here

	await removeWorktree(agent.repoPath, agent.worktreePath, agent.branch, true);

	await appendEvent(agentId, "teardown_done");

	db.update(agents)
		.set({ finishedAt: new Date().toISOString() })
		.where(eq(agents.id, agentId))
		.run();
}

async function pipeline(agentId: string): Promise<void> {
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
	if (!agent) throw new Error(`Agent ${agentId} not found`);

	// Step 1: create worktree
	try {
		await createWorktree(
			agent.repoPath,
			agent.issueNumber,
			agent.issueTitle,
			agentId,
		);
		await appendEvent(agentId, "worktree_created");
	} catch (err) {
		await appendEvent(agentId, "agent_failed", {
			error: String(err),
			step: "worktree_created",
		});
		await teardown(agentId);
		return;
	}

	// Step 2: spawn PTY
	let exitCode: number | null = null;
	try {
		const config = readConfig(agent.repoPath);
		const prompt = buildPrompt(agent.issueTitle, agent.issueBody);

		const args = config.args.includes("-p")
			? [...config.args, prompt]
			: config.args;

		const baseEnv = Object.fromEntries(
			Object.entries(process.env).filter(
				(entry): entry is [string, string] => entry[1] != null,
			),
		);

		const env: NodeJS.ProcessEnv = {
			...baseEnv,
			MOXE_ISSUE_NUMBER: String(agent.issueNumber),
			MOXE_ISSUE_TITLE: agent.issueTitle,
			MOXE_BRANCH: agent.branch,
			MOXE_WORKTREE_PATH: agent.worktreePath,
			MOXE_ROOT_PATH: agent.repoPath,
			MOXE_WORKSPACE_NAME: agent.repo,
		};

		const instance = ptyManager.spawn(agentId, {
			command: config.command,
			args,
			cwd: agent.worktreePath,
			env,
			logPath: agent.logPath ?? join(agent.worktreePath, "agent.log"),
		});

		db.update(agents)
			.set({ pid: instance.pty.pid })
			.where(eq(agents.id, agentId))
			.run();

		await appendEvent(agentId, "agent_start");

		// Step 3: wait for PTY exit
		exitCode = await new Promise<number>((resolve) => {
			if (!instance.alive) {
				resolve(instance.exitCode ?? 1);
				return;
			}
			instance.pty.onExit(({ exitCode: code }) => {
				resolve(code);
			});
		});
	} catch (err) {
		await appendEvent(agentId, "agent_failed", { error: String(err) });
		await teardown(agentId);
		return;
	}

	if (exitCode === 0) {
		await appendEvent(agentId, "agent_done");
	} else {
		await appendEvent(agentId, "agent_failed", { exitCode });
	}

	// Step 4: teardown always runs
	await teardown(agentId);
}

export async function launchAgent(
	repo: string,
	repoPath: string,
	issueNumber: number,
	issueTitle: string,
	issueBody?: string,
) {
	const agentId = nanoid();
	const paths = resolvePaths(issueNumber, issueTitle, agentId);

	const now = new Date().toISOString();
	db.insert(agents)
		.values({
			id: agentId,
			repo,
			repoPath,
			issueNumber,
			issueTitle,
			issueBody: issueBody ?? null,
			branch: paths.branch,
			worktreePath: paths.worktreePath,
			logPath: paths.logPath,
			pid: null,
			portBase: null,
			prNumber: null,
			prUrl: null,
			createdAt: now,
			finishedAt: null,
		})
		.run();

	await appendEvent(agentId, "queued");

	pipeline(agentId).catch((err) => {
		console.error(`[lifecycle] pipeline error for agent ${agentId}:`, err);
	});

	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
	if (!agent) throw new Error(`Agent ${agentId} not found after insert`);
	return agent;
}

export async function killAgent(agentId: string): Promise<void> {
	await ptyManager.kill(agentId);
	await appendEvent(agentId, "killed");
	await teardown(agentId);
}
