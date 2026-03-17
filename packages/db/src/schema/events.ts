import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { agents } from "./agents";

export const events = sqliteTable("events", {
	id: text("id").primaryKey(),
	agentId: text("agent_id")
		.notNull()
		.references(() => agents.id),
	type: text("type").notNull(),
	payload: text("payload"),
	ts: text("ts").notNull(),
});

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

export type AgentStatus =
	| "pending"
	| "setting_up"
	| "running"
	| "completing"
	| "tearing_down"
	| "done"
	| "failed"
	| "killed";

const statusMap: Record<EventType, AgentStatus> = {
	queued: "pending",
	worktree_created: "pending",
	ports_allocated: "pending",
	setup_start: "setting_up",
	setup_done: "setting_up",
	setup_failed: "failed",
	agent_start: "running",
	agent_done: "completing",
	agent_failed: "failed",
	teardown_start: "tearing_down",
	teardown_done: "done",
	teardown_failed: "failed",
	pr_created: "done",
	issue_closed: "done",
	killed: "killed",
};

export function deriveStatus(latestEventType: EventType): AgentStatus {
	return statusMap[latestEventType] ?? "pending";
}
