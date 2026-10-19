CREATE TABLE `reading_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`isbn` text,
	`title` text NOT NULL,
	`author` text,
	`cover_url` text,
	`status` text DEFAULT 'UNREAD' NOT NULL,
	`note` text,
	`card_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reading_items_owner_status` ON `reading_items` (`owner_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `reading_items_owner_isbn_unique` ON `reading_items` (`owner_id`,`isbn`);