import { spawn } from "node:child_process";
import {
	accessSync,
	constants,
	createWriteStream,
	existsSync,
	readFileSync,
} from "node:fs";
import { basename, join, resolve as resolvePath } from "node:path";
import { agents, db, eq, events } from "@moxe/db";
import { appendEvent, getStatus } from "./events.js";
import { deallocatePorts, readGlobalConfig } from "./ports.js";
import { ptyManager } from "./pty.js";
import { removeWorktree } from "./worktree.js";

// ---------------------------------------------------------------------------
// Archivable states
// ---------------------------------------------------------------------------

const ARCHIVABLE_STATUSES = new Set([
	"completed",
	"failed",
	"killed",
	"archive_failed",
]);

// ---------------------------------------------------------------------------
// Config — reads teardown script from .moxe/config.json
// ---------------------------------------------------------------------------

function readTeardownScript(repoPath: string): string | null {
	let raw: Record<string, unknown> = {};
	try {
		const text = readFileSync(join(repoPath, ".moxe", "config.json"), "utf-8");
		raw = JSON.parse(text) as Record<string, unknown>;
	} catch {
		// No config — no teardown
	}

	const configured =
		typeof raw.teardown === "string" ? (raw.teardown as string) : null;
	const scriptPath = configured
		? resolvePath(repoPath, configured)
		: join(repoPath, ".moxe", "teardown.sh");

	if (!existsSync(scriptPath)) return null;
	try {
		accessSync(scriptPath, constants.X_OK);
	} catch {
		console.warn(`[moxe] Warning: ${scriptPath} exists but is not executable`);
	}
	return scriptPath;
}

// ---------------------------------------------------------------------------
// Script runner
// ---------------------------------------------------------------------------

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
// Env helper
// ---------------------------------------------------------------------------

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
// Archive
// ---------------------------------------------------------------------------

export async function archiveAgent(agentId: string): Promise<void> {
	// Validate agent exists
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get();
	if (!agent) throw new Error(`Agent ${agentId} not found`);

	// Validate archivable state
	const status = await getStatus(agentId);
	if (!ARCHIVABLE_STATUSES.has(status)) {
		throw new Error(
			`Cannot archive agent ${agentId}: status is "${status}". Must be one of: ${[...ARCHIVABLE_STATUSES].join(", ")}`,
		);
	}

	await appendEvent(agentId, "archive_start");

	// Kill PTY if still running (safe no-op if dead)
	await ptyManager.kill(agentId);

	// Run teardown script if configured
	const teardownScript = readTeardownScript(agent.repoPath);
	if (teardownScript) {
		const { scriptTimeout } = readGlobalConfig();
		const logPath = agent.logPath ?? join(agent.worktreePath, "agent.log");
		const baseEnv = Object.fromEntries(
			Object.entries(process.env).filter(
				(entry): entry is [string, string] => entry[1] != null,
			),
		);
		const env: NodeJS.ProcessEnv = {
			...baseEnv,
			...buildMoxeEnv(agent),
		};
		await runScript(
			teardownScript,
			agent.worktreePath,
			env,
			logPath,
			scriptTimeout,
		);
	}

	try {
		// Remove worktree and delete the local branch
		await removeWorktree(
			agent.repoPath,
			agent.worktreePath,
			agent.branch,
			false,
		);

		// Free allocated ports
		await deallocatePorts(basename(agent.worktreePath));

		// Set finishedAt
		db.update(agents)
			.set({ finishedAt: new Date().toISOString() })
			.where(eq(agents.id, agentId))
			.run();

		await appendEvent(agentId, "archive_done");

		// Delete events first (FK constraint), then the agent row
		db.delete(events).where(eq(events.agentId, agentId)).run();
		db.delete(agents).where(eq(agents.id, agentId)).run();
	} catch (error) {
		await appendEvent(agentId, "archive_failed", {
			error: String(error),
		});
		throw error;
	}
}
