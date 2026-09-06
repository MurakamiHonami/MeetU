ALTER TABLE `users` ADD `x_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_x_id_unique` ON `users` (`x_id`);