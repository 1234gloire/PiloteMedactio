CREATE TABLE `customer_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`subscriptionId` int,
	`type` enum('Renouvellement','Sous Utilisation','Onboarding Bloque','Compte A Risque') NOT NULL,
	`severity` enum('Info','Attention','Critique') NOT NULL DEFAULT 'Attention',
	`title` varchar(240) NOT NULL,
	`message` text NOT NULL,
	`dueDate` date,
	`status` enum('Ouverte','Resolue','Ignoree') NOT NULL DEFAULT 'Ouverte',
	`dedupeKey` varchar(240) NOT NULL,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_alerts_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `customer_onboarding_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`itemKey` enum('Compte Cree','Formation Effectuee','Premiers Ecrits Generes') NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`completedBy` int,
	`note` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_onboarding_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_onboarding_org_item_unique` UNIQUE(`organizationId`,`itemKey`)
);
--> statement-breakpoint
CREATE TABLE `customer_success_automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`enabled` boolean NOT NULL DEFAULT false,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_success_automations_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_success_automations_name_unique` UNIQUE(`name`),
	CONSTRAINT `customer_success_automations_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `customer_alerts` ADD CONSTRAINT `customer_alerts_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_alerts` ADD CONSTRAINT `customer_alerts_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_onboarding_tasks` ADD CONSTRAINT `customer_onboarding_tasks_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_onboarding_tasks` ADD CONSTRAINT `customer_onboarding_tasks_completedBy_internal_users_id_fk` FOREIGN KEY (`completedBy`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_alerts_org_idx` ON `customer_alerts` (`organizationId`);--> statement-breakpoint
CREATE INDEX `customer_alerts_status_due_idx` ON `customer_alerts` (`status`,`dueDate`);--> statement-breakpoint
CREATE INDEX `customer_onboarding_org_idx` ON `customer_onboarding_tasks` (`organizationId`);