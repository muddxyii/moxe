import { spawn } from "node:child_process";
import {
	accessSync,
	constants,
	createWriteStream,
	existsSync,
	readFileSync,
} from "node:fs";
import { basename, join, resolve as resolvePath } from "node:path";
import { agents, db, eq, nanoid } from "@moxe/db";
import { appendEvent } from "./events.js";
import { closeIssue, createPr, generatePrBody } from "./github.js";
import { allocatePorts, deallocatePorts, readGlobalConfig } from "./ports.js";
import { ptyManager } from "./pty.js";
import { createWorktree, removeWorktree, resolvePaths } from "./worktree.js";

// ---------------------------------------------------------------------------
// Config

interface RepoConfig {
	command: string;
	args: string[];
	setup: string | null;
	teardown: string | null;
	baseBranch: string;
}

function readConfig(repoPath: string): RepoConfig {
	let raw: Record<string, unknown> = {};
	try {
		const text = readFileSync(join(repoPath, ".moxe", "config.json"), "utf-8");
		raw = JSON.parse(text) as Record<string, unknown>;
	} catch {
		// No config — use defaults
	}

	const command = typeof raw.command === "string" ? raw.command : "claude";
	const args = Array.isArray(raw.args) ? (raw.args as string[]) : ["-p"];
	const baseBranch =
		typeof raw.baseBranch === "string" ? raw.baseBranch : "master";

	function resolveScript(key: string, fallbackName: string): string | null {
		const configured =
			typeof raw[key] === "string" ? (raw[key] as string) : null;
		const scriptPath = configured
			? resolvePath(repoPath, configured)
			: join(repoPath, ".moxe", fallbackName);
		if (!existsSync(scriptPath)) return null;
		try {
			accessSync(scriptPath, constants.X_OK);
		} catch {
			console.warn(
				`[moxe] Warning: ${scriptPath} exists but is not executable`,
			);
		}
		return scriptPath;
	}

	return {
		command,
		args,
		setup: resolveScript("setup", "setup.sh"),
		teardown: resolveScript("teardown", "teardown.sh"),
		baseBranch,
	};
}

// ---------------------------------------------------------------------------
// Env helpers

function buildMoxeEnv(agent: {
	issueNumber: number;
	issueTitle: string;
	branch: string;
	worktreePath: string;
	repoPath: string;
	portBase: number | null;
}): Record<string, string> {
	const portBase = agent.portBase ?? 0;
	return {
		MOXE_ISSUE_NUMBER: String(agent.issueNumber),
		MOXE_ISSUE_TITLE: agent.issueTitle,
		MOXE_BRANCH: agent.branch,
		MOXE_WORKTREE_PATH: agent.worktreePath,
		MOXE_ROOT_PATH: agent.repoPath,
		MOXE_WORKSPACE_NAME: basename(agent.worktreePath),
		MOXE_PORT_BASE: String(portBase),
		MOXE_PORT_API: String(portBase),
		MOXE_PORT_WEB: String(portBase + 1),
		MOXE_PORT_DB: String(portBase + 2),
	};
}

// ---------------------------------------------------------------------------
// Script runner

async function runScript(
	scriptPath: string,
	cwd: string,
	env: NodeJS.ProcessEnv,
	logPath: string,
	timeoutMs: number,
): Promise<{ exitCode: number }> {
	return new Promise((resolve) => {
		const logStream = createWriteStream(logPath, { flags: "a" });
		const child = spawn(scriptPath, [], {
			cwd,
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		child.stdout.pipe(logStream, { end: false });
		child.stderr.pipe(logStream, { end: false });

		let settled = false;

		const timer = setTimeout(() => {
			if (settled) return;
			logStream.write(
				`\n[moxe] Script timed out after ${timeoutMs}ms, sending SIGTERM\n`,
			);
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!settled) child.kill("SIGKILL");
			}, 2000);
		}, timeoutMs);

		child.on("close", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			logStream.end(() => resolve({ exitCode: code ?? 1 }));
		});

		child.on("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			logStream.write(`\n[moxe] Script error: ${err.message}\n`);
			logStream.end(() => resolve({ exitCode: 1 }));
		});
	});
}

// ---------------------------------------------------------------------------
// Prompt builder

function buildPrompt(issueTitle: string, issueBody?: string | null): string {
	const body = issueBody ? `\n\n${issueBody}` : "";
	return `Fix the following GitHub issue:\n\nTitle: ${issueTitle}${body}`;
}

// ---------------------------------------------------------------------------
// Teardown

async function teardown(agentId: string): Promise<void> {
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
	if (!agent) return;

	await appendEvent(agentId, "teardown_start");

	ptyManager.cleanup(agentId);

	const config = readConfig(agent.repoPath);
	const { scriptTimeout } = readGlobalConfig();
	const logPath = agent.logPath ?? join(agent.worktreePath, "agent.log");
	const baseEnv = Object.fromEntries(
		Object.entries(process.env).filter(
			(entry): entry is [string, string] => entry[1] != null,
		),
	);
	const env: NodeJS.ProcessEnv = { ...baseEnv, ...buildMoxeEnv(agent) };

	// Step 1: run teardown.sh (failure is logged, not fatal)
	if (config.teardown) {
		try {
			const { exitCode } = await runScript(
				config.teardown,
				agent.worktreePath,
				env,
				logPath,
				scriptTimeout,
			);
			if (exitCode !== 0) {
				console.warn(
					`[moxe] teardown.sh exited with code ${exitCode} for agent ${agentId}`,
				);
			}
		} catch (err) {
			console.warn(`[moxe] teardown.sh threw for agent ${agentId}:`, err);
		}
	}

	// Step 2: remove worktree (failure is logged, not fatal)
	try {
		await removeWorktree(
			agent.repoPath,
			agent.worktreePath,
			agent.branch,
			true,
		);
	} catch (err) {
		console.warn(`[moxe] removeWorktree failed for agent ${agentId}:`, err);
	}

	// Step 3: deallocate ports (failure is logged, not fatal)
	try {
		await deallocatePorts(basename(agent.worktreePath));
	} catch (err) {
		console.warn(`[moxe] deallocatePorts failed for agent ${agentId}:`, err);
	}

	await appendEvent(agentId, "teardown_done");

	db.update(agents)
		.set({ finishedAt: new Date().toISOString() })
		.where(eq(agents.id, agentId))
		.run();
}

// ---------------------------------------------------------------------------
// Pipeline

async function pipeline(agentId: string): Promise<void> {
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
	if (!agent) throw new Error(`Agent ${agentId} not found`);

	const config = readConfig(agent.repoPath);
	const { scriptTimeout } = readGlobalConfig();
	const logPath = agent.logPath ?? join(agent.worktreePath, "agent.log");

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

	// Step 2: allocate ports
	try {
		const workspaceName = basename(agent.worktreePath);
		const portBase = await allocatePorts(workspaceName, agentId);
		db.update(agents).set({ portBase }).where(eq(agents.id, agentId)).run();
		await appendEvent(agentId, "ports_allocated", { portBase });
	} catch (err) {
		await appendEvent(agentId, "agent_failed", {
			error: String(err),
			step: "ports_allocated",
		});
		await teardown(agentId);
		return;
	}

	// Re-fetch agent to get updated portBase
	const agentWithPorts = db
		.select()
		.from(agents)
		.where(eq(agents.id, agentId))
		.get();
	if (!agentWithPorts) throw new Error(`Agent ${agentId} vanished`);

	const baseEnv = Object.fromEntries(
		Object.entries(process.env).filter(
			(entry): entry is [string, string] => entry[1] != null,
		),
	);
	const env: NodeJS.ProcessEnv = {
		...baseEnv,
		...buildMoxeEnv(agentWithPorts),
	};

	// Step 3: run setup script
	if (config.setup) {
		await appendEvent(agentId, "setup_start");
		try {
			const { exitCode } = await runScript(
				config.setup,
				agent.worktreePath,
				env,
				logPath,
				scriptTimeout,
			);
			if (exitCode !== 0) {
				await appendEvent(agentId, "setup_failed", { exitCode });
				await teardown(agentId);
				return;
			}
		} catch (err) {
			await appendEvent(agentId, "setup_failed", { error: String(err) });
			await teardown(agentId);
			return;
		}
		await appendEvent(agentId, "setup_done");
	}

	// Step 4: spawn PTY
	let exitCode: number | null = null;
	try {
		const prompt = buildPrompt(agent.issueTitle, agent.issueBody);
		const args = config.args.includes("-p")
			? [...config.args, prompt]
			: config.args;

		const instance = ptyManager.spawn(agentId, {
			command: config.command,
			args,
			cwd: agent.worktreePath,
			env,
			logPath,
		});

		db.update(agents)
			.set({ pid: instance.pty.pid })
			.where(eq(agents.id, agentId))
			.run();

		await appendEvent(agentId, "agent_start");

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

	// Step 5: generate PR body while worktree still exists (success path only)
	let prBody: string | null = null;
	if (exitCode === 0) {
		try {
			prBody = await generatePrBody(
				agent.worktreePath,
				agent.issueNumber,
				config.baseBranch,
			);
		} catch (err) {
			console.warn(`[moxe] generatePrBody failed for agent ${agentId}:`, err);
		}
	}

	if (exitCode === 0) {
		await appendEvent(agentId, "agent_done");
	} else {
		await appendEvent(agentId, "agent_failed", { exitCode });
	}

	// Step 6: teardown always runs
	await teardown(agentId);

	// Step 7: create PR and close issue (success path only, after worktree removed)
	if (exitCode === 0 && prBody) {
		try {
			const { prNumber, prUrl } = await createPr(
				agent.repo,
				agent.branch,
				agent.issueNumber,
				agent.issueTitle,
				prBody,
				config.baseBranch,
			);
			await appendEvent(agentId, "pr_created", { prNumber, prUrl });
			db.update(agents)
				.set({ prNumber, prUrl })
				.where(eq(agents.id, agentId))
				.run();
		} catch (err) {
			console.error(`[moxe] createPr failed for agent ${agentId}:`, err);
		}

		try {
			await closeIssue(agent.repo, agent.issueNumber);
			await appendEvent(agentId, "issue_closed");
		} catch (err) {
			console.error(`[moxe] closeIssue failed for agent ${agentId}:`, err);
		}
	}
}

// ---------------------------------------------------------------------------
// Public API

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
