CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`issue_number` integer NOT NULL,
	`issue_title` text NOT NULL,
	`issue_body` text,
	`branch` text NOT NULL,
	`worktree_path` text NOT NULL,
	`log_path` text,
	`pid` integer,
	`port_base` integer,
	`pr_number` integer,
	`pr_url` text,
	`created_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`ts` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
