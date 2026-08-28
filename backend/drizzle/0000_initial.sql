CREATE TABLE `card_tags` (
	`card_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`card_type` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`card_id`, `tag_id`),
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_tags_tag` ON `card_tags` (`tag_id`,`card_type`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`min_match_count` integer DEFAULT 2 NOT NULL,
	`required_tags` text DEFAULT '[]' NOT NULL,
	`dates` text DEFAULT '[]' NOT NULL,
	`lat` real,
	`lon` real,
	`location_name` text,
	`geohash` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cards_owner` ON `cards` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_cards_status_created` ON `cards` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_cards_geohash` ON `cards` (`geohash`);--> statement-breakpoint
CREATE TABLE `match_reads` (
	`match_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_at` text,
	PRIMARY KEY(`match_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`card_a_id` text NOT NULL,
	`card_b_id` text NOT NULL,
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`matched_tags` text NOT NULL,
	`matched_labels` text DEFAULT '[]' NOT NULL,
	`match_count` integer NOT NULL,
	`distance_km` real,
	`accepted_a` integer DEFAULT 0 NOT NULL,
	`accepted_b` integer DEFAULT 0 NOT NULL,
	`last_message_at` text,
	`last_message_by` text,
	`last_message_preview` text,
	`last_notified_at` integer,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`card_a_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_b_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_matches_user_a` ON `matches` (`user_a_id`);--> statement-breakpoint
CREATE INDEX `idx_matches_user_b` ON `matches` (`user_b_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_type` text DEFAULT 'MATCH' NOT NULL,
	`thread_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`text` text,
	`image_key` text,
	`lat` real,
	`lon` real,
	`location_name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_thread` ON `messages` (`thread_type`,`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_user_id` text NOT NULL,
	`match_id` text,
	`reason` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reports_target` ON `reports` (`target_user_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_to_user` ON `reviews` (`to_user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_match_from_unique` ON `reviews` (`match_id`,`from_user_id`);--> statement-breakpoint
CREATE TABLE `swipes` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_swipes_user_action` ON `swipes` (`user_id`,`action`);--> statement-breakpoint
CREATE TABLE `tag_cooccurrences` (
	`tag_a` text NOT NULL,
	`tag_b` text NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`tag_a`, `tag_b`)
);
--> statement-breakpoint
CREATE INDEX `idx_cooc_tag_a` ON `tag_cooccurrences` (`tag_a`,`hits`);--> statement-breakpoint
CREATE INDEX `idx_cooc_tag_b` ON `tag_cooccurrences` (`tag_b`,`hits`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_read_at` text,
	PRIMARY KEY(`group_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_group_members_user` ON `trade_group_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `trade_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`length` integer NOT NULL,
	`steps` text NOT NULL,
	`members` text NOT NULL,
	`responses` text DEFAULT '{}' NOT NULL,
	`found_by` text,
	`last_message_at` text,
	`last_message_by` text,
	`last_message_preview` text,
	`last_notified_at` integer,
	`status` text DEFAULT 'NEW' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`display_name` text NOT NULL,
	`picture_url` text,
	`rating_avg` real DEFAULT 0 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`report_count` integer DEFAULT 0 NOT NULL,
	`trade_count` integer DEFAULT 0 NOT NULL,
	`favorite_tags` text DEFAULT '[]' NOT NULL,
	`favorite_labels` text DEFAULT '{}' NOT NULL,
	`home_lat` real,
	`home_lon` real,
	`home_name` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);