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
	| "init_start"
	| "init_done"
	| "init_failed"
	| "agent_start"
	| "agent_done"
	| "agent_failed"
	| "archive_start"
	| "archive_done"
	| "archive_failed"
	| "killed";

export type AgentStatus =
	| "pending"
	| "setting_up"
	| "running"
	| "completed"
	| "archiving"
	| "archive_failed"
	| "failed"
	| "killed";

const statusMap: Record<EventType, AgentStatus> = {
	queued: "pending",
	worktree_created: "pending",
	ports_allocated: "pending",
	init_start: "setting_up",
	init_done: "setting_up",
	init_failed: "failed",
	agent_start: "running",
	agent_done: "completed",
	agent_failed: "failed",
	archive_start: "archiving",
	archive_done: "archiving",
	archive_failed: "archive_failed",
	killed: "killed",
};

export function deriveStatus(latestEventType: EventType): AgentStatus {
	return statusMap[latestEventType] ?? "pending";
}
