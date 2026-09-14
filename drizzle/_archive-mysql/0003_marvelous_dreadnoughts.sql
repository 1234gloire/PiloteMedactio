CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`eventType` enum('Rendez-vous Interne','Demo','Rendez-vous Client','Echeance','Autre') NOT NULL DEFAULT 'Rendez-vous Interne',
	`organizationId` int,
	`contactId` int,
	`organizerId` int,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp,
	`allDay` boolean NOT NULL DEFAULT false,
	`location` varchar(240),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `establishment_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`type` enum('Convention','Contrat','DPA','Avenant','Autre') NOT NULL DEFAULT 'Contrat',
	`status` enum('Brouillon','A Signer','Actif','Expire','Resilie') NOT NULL DEFAULT 'Brouillon',
	`startDate` date,
	`endDate` date,
	`signedAt` date,
	`documentKey` text,
	`documentUrl` text,
	`documentName` varchar(240),
	`documentMimeType` varchar(120),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `establishment_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('Ticket','Tache','Facture','Contrat','Evenement') NOT NULL,
	`entityId` int NOT NULL,
	`alertType` enum('SLA Depasse','Echeance Tache','Facture Impayee','Contrat A Renouveler','Rendez-vous Proche') NOT NULL,
	`severity` enum('Info','Attention','Critique') NOT NULL DEFAULT 'Attention',
	`title` varchar(240) NOT NULL,
	`message` text NOT NULL,
	`dueAt` timestamp,
	`link` text,
	`status` enum('Ouverte','Resolue','Ignoree') NOT NULL DEFAULT 'Ouverte',
	`dedupeKey` varchar(240) NOT NULL,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `support_alerts_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `support_automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`enabled` boolean NOT NULL DEFAULT false,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_automations_id` PRIMARY KEY(`id`),
	CONSTRAINT `support_automations_name_unique` UNIQUE(`name`),
	CONSTRAINT `support_automations_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `support_ticket_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`authorId` int,
	`eventType` enum('Commentaire','Changement Statut','Note Interne','Relance Client') NOT NULL DEFAULT 'Commentaire',
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_ticket_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_tasks` ADD `priority` enum('Basse','Moyenne','Haute') DEFAULT 'Moyenne' NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_tasks` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `admin_tasks` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `invoices` ADD `issuedAt` date;--> statement-breakpoint
ALTER TABLE `invoices` ADD `reminderCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `lastReminderAt` timestamp;--> statement-breakpoint
ALTER TABLE `invoices` ADD `nextReminderDate` date;--> statement-breakpoint
ALTER TABLE `invoices` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `slaDueAt` timestamp;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `firstRespondedAt` timestamp;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `resolvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_organizerId_internal_users_id_fk` FOREIGN KEY (`organizerId`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `establishment_contracts` ADD CONSTRAINT `establishment_contracts_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_ticket_events` ADD CONSTRAINT `support_ticket_events_ticketId_support_tickets_id_fk` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_ticket_events` ADD CONSTRAINT `support_ticket_events_authorId_internal_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `calendar_events_start_idx` ON `calendar_events` (`startAt`);--> statement-breakpoint
CREATE INDEX `establishment_contracts_org_idx` ON `establishment_contracts` (`organizationId`);--> statement-breakpoint
CREATE INDEX `establishment_contracts_end_idx` ON `establishment_contracts` (`status`,`endDate`);--> statement-breakpoint
CREATE INDEX `support_alerts_status_due_idx` ON `support_alerts` (`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `support_ticket_events_ticket_idx` ON `support_ticket_events` (`ticketId`);--> statement-breakpoint
CREATE INDEX `admin_tasks_due_idx` ON `admin_tasks` (`status`,`dueDate`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_idx` ON `support_tickets` (`status`);--> statement-breakpoint
CREATE INDEX `support_tickets_sla_idx` ON `support_tickets` (`slaDueAt`);