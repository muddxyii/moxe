import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
	const mockAgent = {
		id: "test-agent-id",
		repo: "owner/repo",
		repoPath: "/tmp/repo",
		issueNumber: 42,
		issueTitle: "Test issue",
		issueBody: "Fix the bug",
		branch: "feature/issue-42-test-issue-abc1234",
		worktreePath: "/tmp/moxe-worktrees/issue-42-test-issue-abc1234",
		logPath: "/tmp/moxe-worktrees/issue-42-test-issue-abc1234/agent.log",
		pid: 12345,
		portBase: 4000,
		createdAt: "2026-01-01T00:00:00.000Z",
		finishedAt: null,
	};

	const removeWorktree = vi.fn().mockResolvedValue(undefined);
	const deallocatePorts = vi.fn().mockResolvedValue(undefined);
	const appendEvent = vi.fn().mockResolvedValue(undefined);
	const ptyKill = vi.fn().mockResolvedValue(undefined);
	const ptyCleanup = vi.fn();

	const dbDeleteRun = vi.fn();
	const dbUpdateRun = vi.fn();

	return {
		mockAgent,
		removeWorktree,
		deallocatePorts,
		appendEvent,
		ptyKill,
		ptyCleanup,
		dbDeleteRun,
		dbUpdateRun,
	};
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../worktree.js", () => ({
	removeWorktree: mocks.removeWorktree,
}));

vi.mock("../ports.js", () => ({
	deallocatePorts: mocks.deallocatePorts,
	readGlobalConfig: vi.fn().mockReturnValue({
		portRangeStart: 4000,
		portsPerWorkspace: 10,
		scriptTimeout: 300_000,
	}),
}));

vi.mock("../events.js", () => ({
	appendEvent: mocks.appendEvent,
	getStatus: vi.fn().mockResolvedValue("completed"),
}));

vi.mock("../pty.js", () => ({
	ptyManager: {
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
	execFile: vi.fn(),
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
			update: vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						run: mocks.dbUpdateRun,
					}),
				}),
			}),
			select: vi.fn().mockImplementation(() => makeSelectChain()),
			delete: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					run: mocks.dbDeleteRun,
				}),
			}),
		},
		agents: { id: "id" },
		eq: vi.fn(),
		nanoid: vi.fn().mockReturnValue("test-event-id"),
		events: {},
		deriveStatus: vi.fn().mockReturnValue("completed"),
		desc: vi.fn(),
		asc: vi.fn(),
	};
});

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import { archiveAgent } from "../archive.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("agent archive", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("archives a completed agent by removing the worktree, deleting the branch, and freeing ports", async () => {
		await archiveAgent("test-agent-id");

		expect(mocks.removeWorktree).toHaveBeenCalledWith(
			"/tmp/repo",
			"/tmp/moxe-worktrees/issue-42-test-issue-abc1234",
			"feature/issue-42-test-issue-abc1234",
			false,
		);
		expect(mocks.deallocatePorts).toHaveBeenCalled();
	});

	it("kills the PTY before cleanup", async () => {
		await archiveAgent("test-agent-id");

		expect(mocks.ptyKill).toHaveBeenCalledWith("test-agent-id");
	});

	it("emits archive_start and archive_done events", async () => {
		await archiveAgent("test-agent-id");

		const eventTypes = mocks.appendEvent.mock.calls.map(
			(call: unknown[]) => call[1],
		);
		expect(eventTypes).toContain("archive_start");
		expect(eventTypes).toContain("archive_done");
	});

	it("sets finishedAt on the agent row", async () => {
		await archiveAgent("test-agent-id");

		expect(mocks.dbUpdateRun).toHaveBeenCalled();
	});

	it("deletes the agent row after successful cleanup", async () => {
		await archiveAgent("test-agent-id");

		expect(mocks.dbDeleteRun).toHaveBeenCalled();
	});

	it("keeps the agent row and marks archive_failed on partial cleanup failure", async () => {
		mocks.removeWorktree.mockRejectedValueOnce(
			new Error("worktree removal failed"),
		);

		await expect(archiveAgent("test-agent-id")).rejects.toThrow(
			"worktree removal failed",
		);

		const eventTypes = mocks.appendEvent.mock.calls.map(
			(call: unknown[]) => call[1],
		);
		expect(eventTypes).toContain("archive_failed");
		expect(mocks.dbDeleteRun).not.toHaveBeenCalled();
	});

	it("rejects archive for agents not in an archivable state", async () => {
		const { getStatus } = await import("../events.js");
		vi.mocked(getStatus).mockResolvedValueOnce("running" as "completed");

		await expect(archiveAgent("test-agent-id")).rejects.toThrow(
			/cannot archive/i,
		);
	});
});
