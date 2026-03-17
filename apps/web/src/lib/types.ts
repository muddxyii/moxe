export type AgentStatus =
	| "pending"
	| "setting_up"
	| "running"
	| "completing"
	| "tearing_down"
	| "done"
	| "failed"
	| "killed";

export type EventType =
	| "queued"
	| "worktree_created"
	| "ports_allocated"
	| "setup_start"
	| "setup_done"
	| "setup_failed"
	| "agent_start"
	| "agent_done"
	| "agent_failed"
	| "teardown_start"
	| "teardown_done"
	| "teardown_failed"
	| "pr_created"
	| "issue_closed"
	| "killed";

export interface AgentEvent {
	id: string;
	agentId: string;
	type: EventType;
	payload: string | null;
	ts: string;
}

export interface Agent {
	id: string;
	repo: string;
	repoPath: string;
	issueNumber: number;
	issueTitle: string;
	issueBody: string | null;
	branch: string | null;
	worktreePath: string | null;
	logPath: string | null;
	pid: number | null;
	portBase: number | null;
	prNumber: number | null;
	prUrl: string | null;
	createdAt: string;
	finishedAt: string | null;
	status: AgentStatus;
	events?: AgentEvent[];
}

export interface Issue {
	number: number;
	title: string;
	body: string;
	labels: string[];
}

export interface DiffFile {
	path: string;
	status: "added" | "modified" | "deleted" | "renamed";
	diff: string;
}

export interface Repo {
	owner: string;
	name: string;
	localPath: string;
}
