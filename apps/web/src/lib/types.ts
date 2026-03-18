export type AgentStatus =
	| "pending"
	| "setting_up"
	| "running"
	| "completed"
	| "archiving"
	| "archive_failed"
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
	| "archive_start"
	| "archive_done"
	| "archive_failed"
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

export type WorkspaceGroup = {
	workspaceId: string; // e.g. "owner/repo"
	label: string; // display name
	activeAgents: Agent[];
	completedAgents: Agent[];
};
