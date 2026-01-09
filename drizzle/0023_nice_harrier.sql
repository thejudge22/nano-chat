ALTER TABLE `messages` ADD `starred` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `mcp_enabled` integer DEFAULT false NOT NULL;