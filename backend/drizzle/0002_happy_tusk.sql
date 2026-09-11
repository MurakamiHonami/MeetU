PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_user_id` text NOT NULL,
	`match_id` text NOT NULL,
	`reason` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_reports`("id", "reporter_id", "target_user_id", "match_id", "reason", "detail", "status", "created_at") SELECT "id", "reporter_id", "target_user_id", "match_id", "reason", "detail", "status", "created_at" FROM `reports`;--> statement-breakpoint
DROP TABLE `reports`;--> statement-breakpoint
ALTER TABLE `__new_reports` RENAME TO `reports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_reports_target` ON `reports` (`target_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reports_reporter_match_unique` ON `reports` (`reporter_id`,`match_id`);