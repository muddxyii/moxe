import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — these are available inside vi.mock factories
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
	const mockAgent = {
		id: "test-agent-id",
		repo: "owner/repo",
		repoPath: "/tmp/repo",
		issueNumber: 42,
		issueTitle: "Test issue",
		issueBody: "Fix the bug",
		branch: "moxe/42-test-issue-abc123",
		worktreePath: "/tmp/moxe-worktrees/42-test-issue-abc123",
		logPath: "/tmp/moxe-worktrees/42-test-issue-abc123/agent.log",
		pid: null,
		portBase: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		finishedAt: null,
	};

	const createWorktree = vi.fn().mockResolvedValue(undefined);
	const removeWorktree = vi.fn().mockResolvedValue(undefined);
	const resolvePaths = vi.fn().mockReturnValue({
		branch: "moxe/42-test-issue-abc123",
		worktreePath: "/tmp/moxe-worktrees/42-test-issue-abc123",
		logPath: "/tmp/moxe-worktrees/42-test-issue-abc123/agent.log",
	});

	const allocatePorts = vi.fn().mockResolvedValue(4000);
	const deallocatePorts = vi.fn().mockResolvedValue(undefined);
	const readGlobalConfig = vi.fn().mockReturnValue({
		portRangeStart: 4000,
		portsPerWorkspace: 10,
		scriptTimeout: 300_000,
	});

	const appendEvent = vi.fn().mockResolvedValue(undefined);
	const resolveBaseBranch = vi.fn().mockResolvedValue("master");

	const ptySpawn = vi.fn();
	const ptyKill = vi.fn().mockResolvedValue(undefined);
	const ptyCleanup = vi.fn();

	const dbUpdate = vi.fn().mockReturnValue({
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				run: vi.fn(),
			}),
		}),
	});

	return {
		mockAgent,
		createWorktree,
		removeWorktree,
		resolvePaths,
		allocatePorts,
		deallocatePorts,
		readGlobalConfig,
		appendEvent,
		resolveBaseBranch,
		ptySpawn,
		ptyKill,
		ptyCleanup,
		dbUpdate,
	};
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../worktree.js", () => ({
	createWorktree: mocks.createWorktree,
	removeWorktree: mocks.removeWorktree,
	resolvePaths: mocks.resolvePaths,
}));

vi.mock("../ports.js", () => ({
	allocatePorts: mocks.allocatePorts,
	deallocatePorts: mocks.deallocatePorts,
	readGlobalConfig: mocks.readGlobalConfig,
}));

vi.mock("../events.js", () => ({
	appendEvent: mocks.appendEvent,
}));

vi.mock("../base-branch.js", () => ({
	resolveBaseBranch: mocks.resolveBaseBranch,
}));

vi.mock("../github.js", () => ({
	generatePrBody: vi.fn().mockResolvedValue("PR body"),
	createPr: vi
		.fn()
		.mockResolvedValue({ prNumber: 1, prUrl: "https://example.com/pr/1" }),
	closeIssue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../pty.js", () => ({
	ptyManager: {
		spawn: mocks.ptySpawn,
		kill: mocks.ptyKill,
		cleanup: mocks.ptyCleanup,
	},
}));

vi.mock("node:fs", async () => {
	const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
	return {
		...actual,
		readFileSync: vi.fn().mockImplementation((path: string) => {
			if (typeof path === "string" && path.endsWith("config.json")) {
				return JSON.stringify({});
			}
			throw new Error("ENOENT");
		}),
		existsSync: vi.fn().mockReturnValue(false),
		accessSync: vi.fn(),
		createWriteStream: vi.fn().mockReturnValue({
			write: vi.fn(),
			end: vi.fn((cb?: () => void) => cb?.()),
			pipe: vi.fn(),
		}),
	};
});

vi.mock("node:child_process", () => ({
	spawn: vi.fn(),
}));

vi.mock("@moxe/db", () => {
	const makeSelectChain = () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock chain requires self-reference
		const chain: any = {};
		chain.from = vi.fn().mockReturnValue(chain);
		chain.where = vi.fn().mockReturnValue(chain);
		chain.orderBy = vi.fn().mockReturnValue(chain);
		chain.limit = vi.fn().mockReturnValue(chain);
		chain.get = vi.fn().mockReturnValue(mocks.mockAgent);
		chain.all = vi.fn().mockReturnValue([mocks.mockAgent]);
		return chain;
	};

	return {
		db: {
			insert: vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					run: vi.fn(),
				}),
			}),
			update: mocks.dbUpdate,
			select: vi.fn().mockImplementation(() => makeSelectChain()),
		},
		agents: { id: "id" },
		eq: vi.fn(),
		nanoid: vi.fn().mockReturnValue("test-agent-id"),
		events: {},
		deriveStatus: vi.fn(),
		desc: vi.fn(),
		asc: vi.fn(),
	};
});

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import { killAgent, launchAgent } from "../lifecycle.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupPtyExit(exitCode: number) {
	mocks.ptySpawn.mockImplementation(() => {
		const instance = {
			pty: {
				pid: 12345,
				onExit: (handler: (e: { exitCode: number }) => void) => {
					setTimeout(() => handler({ exitCode }), 0);
				},
			},
			alive: true,
			exitCode: null,
			logStream: { write: vi.fn(), end: vi.fn() },
			subscribers: new Set(),
		};
		return instance;
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("agent lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Re-setup default dbUpdate mock after clearAllMocks
		mocks.dbUpdate.mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					run: vi.fn(),
				}),
			}),
		});
	});

	it("keeps the worktree and ports after a successful agent run", async () => {
		setupPtyExit(0);

		await launchAgent(
			"owner/repo",
			"/tmp/repo",
			42,
			"Test issue",
			"Fix the bug",
		);
		// Give the background pipeline time to complete
		await new Promise((r) => setTimeout(r, 100));

		expect(mocks.removeWorktree).not.toHaveBeenCalled();
		expect(mocks.deallocatePorts).not.toHaveBeenCalled();
		expect(mocks.appendEvent).toHaveBeenCalledWith(
			"test-agent-id",
			"agent_done",
		);
	});

	it("preserves failed agents until archive", async () => {
		setupPtyExit(1);

		await launchAgent(
			"owner/repo",
			"/tmp/repo",
			42,
			"Test issue",
			"Fix the bug",
		);
		await new Promise((r) => setTimeout(r, 100));

		expect(mocks.removeWorktree).not.toHaveBeenCalled();
		expect(mocks.deallocatePorts).not.toHaveBeenCalled();
		expect(mocks.appendEvent).toHaveBeenCalledWith(
			"test-agent-id",
			"agent_failed",
			{ exitCode: 1 },
		);
	});

	it("does not set finishedAt when agent completes", async () => {
		setupPtyExit(0);

		await launchAgent(
			"owner/repo",
			"/tmp/repo",
			42,
			"Test issue",
			"Fix the bug",
		);
		await new Promise((r) => setTimeout(r, 100));

		// Check that no update call sets finishedAt
		for (const result of mocks.dbUpdate.mock.results) {
			if (result.type === "return" && result.value?.set?.mock) {
				for (const [arg] of result.value.set.mock.calls) {
					expect(arg).not.toHaveProperty("finishedAt");
				}
			}
		}
	});

	it("does not create PRs or close issues after completion", async () => {
		setupPtyExit(0);

		await launchAgent(
			"owner/repo",
			"/tmp/repo",
			42,
			"Test issue",
			"Fix the bug",
		);
		await new Promise((r) => setTimeout(r, 100));

		const eventTypes = mocks.appendEvent.mock.calls.map(
			(call: unknown[]) => call[1],
		);
		expect(eventTypes).not.toContain("pr_created");
		expect(eventTypes).not.toContain("issue_closed");
		expect(eventTypes).not.toContain("cleanup_start");
		expect(eventTypes).not.toContain("cleanup_done");
	});

	it("kill stops PTY and marks killed without cleanup", async () => {
		await killAgent("test-agent-id");

		expect(mocks.ptyKill).toHaveBeenCalledWith("test-agent-id");
		expect(mocks.appendEvent).toHaveBeenCalledWith("test-agent-id", "killed");
		expect(mocks.removeWorktree).not.toHaveBeenCalled();
		expect(mocks.deallocatePorts).not.toHaveBeenCalled();
	});
});
