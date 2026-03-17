import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
	id: text("id").primaryKey(),
	repo: text("repo").notNull(),
	issueNumber: integer("issue_number").notNull(),
	issueTitle: text("issue_title").notNull(),
	issueBody: text("issue_body"),
	branch: text("branch").notNull(),
	worktreePath: text("worktree_path").notNull(),
	logPath: text("log_path"),
	pid: integer("pid"),
	portBase: integer("port_base"),
	prNumber: integer("pr_number"),
	prUrl: text("pr_url"),
	createdAt: text("created_at").notNull(),
	finishedAt: text("finished_at"),
});
