CREATE TABLE `marketing_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int,
	`title` varchar(240) NOT NULL,
	`assetType` enum('Plaquette','Argumentaire','Etude de Cas','Presentation','Visuel','Autre') NOT NULL DEFAULT 'Autre',
	`description` text,
	`storageKey` text NOT NULL,
	`fileUrl` text NOT NULL,
	`fileName` varchar(240) NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`sizeBytes` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int,
	`title` varchar(240) NOT NULL,
	`eventType` enum('Webinaire','Demo Collective','Salon','Atelier') NOT NULL DEFAULT 'Webinaire',
	`scheduledAt` timestamp NOT NULL,
	`registrationCount` int NOT NULL DEFAULT 0,
	`attendeeCount` int NOT NULL DEFAULT 0,
	`meetingsBooked` int NOT NULL DEFAULT 0,
	`status` enum('Planifie','Termine','Annule') NOT NULL DEFAULT 'Planifie',
	`meetingUrl` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int,
	`organizationId` int,
	`contactId` int,
	`dealId` int,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(40),
	`jobTitle` varchar(200),
	`organizationName` varchar(240) NOT NULL,
	`organizationType` enum('Hopital Public','Clinique Privee','Groupement Hospitalier','Cabinet Liberal') NOT NULL DEFAULT 'Cabinet Liberal',
	`status` enum('Nouveau','Qualifie','RDV Planifie','Converti','Rejete') NOT NULL DEFAULT 'Nouveau',
	`source` enum('Site Web','Import','Evenement','Manuel') NOT NULL DEFAULT 'Site Web',
	`utmSource` varchar(160),
	`utmMedium` varchar(160),
	`utmCampaign` varchar(240),
	`consentToContact` boolean NOT NULL DEFAULT false,
	`notes` text,
	`qualifiedAt` timestamp,
	`convertedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `content_calendar` ADD `brief` text;--> statement-breakpoint
ALTER TABLE `content_calendar` ADD `targetAudience` varchar(240);--> statement-breakpoint
ALTER TABLE `content_calendar` ADD `draftContent` text;--> statement-breakpoint
ALTER TABLE `content_calendar` ADD `publicationUrl` text;--> statement-breakpoint
ALTER TABLE `content_calendar` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `marketing_campaigns` ADD `objective` text;--> statement-breakpoint
ALTER TABLE `marketing_campaigns` ADD `targetLeads` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_campaigns` ADD `attributedRevenue` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `marketing_assets` ADD CONSTRAINT `marketing_assets_campaignId_marketing_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `marketing_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_assets` ADD CONSTRAINT `marketing_assets_createdBy_internal_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_events` ADD CONSTRAINT `marketing_events_campaignId_marketing_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `marketing_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_leads` ADD CONSTRAINT `marketing_leads_campaignId_marketing_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `marketing_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_leads` ADD CONSTRAINT `marketing_leads_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_leads` ADD CONSTRAINT `marketing_leads_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_leads` ADD CONSTRAINT `marketing_leads_dealId_deals_id_fk` FOREIGN KEY (`dealId`) REFERENCES `deals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `marketing_assets_campaign_idx` ON `marketing_assets` (`campaignId`);--> statement-breakpoint
CREATE INDEX `marketing_assets_type_idx` ON `marketing_assets` (`assetType`);--> statement-breakpoint
CREATE INDEX `marketing_events_campaign_idx` ON `marketing_events` (`campaignId`);--> statement-breakpoint
CREATE INDEX `marketing_events_date_idx` ON `marketing_events` (`scheduledAt`);--> statement-breakpoint
CREATE INDEX `marketing_leads_campaign_idx` ON `marketing_leads` (`campaignId`);--> statement-breakpoint
CREATE INDEX `marketing_leads_status_idx` ON `marketing_leads` (`status`);--> statement-breakpoint
CREATE INDEX `marketing_leads_email_idx` ON `marketing_leads` (`email`);