CREATE TABLE `admin_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`organizationId` int,
	`assignedTo` int,
	`dueDate` date,
	`status` enum('A Faire','En Cours','Fait') NOT NULL DEFAULT 'A Faire',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(160) NOT NULL,
	`targetTable` varchar(120),
	`targetId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionDate` date NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`type` enum('Credit','Debit') NOT NULL,
	`description` text,
	`matchedInvoiceId` int,
	`matchedExpenseId` int,
	`isReconciled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `changelog_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`releaseDate` date,
	`type` enum('Nouvelle Fonctionnalite','Amelioration','Correction') NOT NULL DEFAULT 'Amelioration',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `changelog_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(40),
	`specialty` varchar(160),
	`jobTitle` varchar(200),
	`isLicenseActive` boolean NOT NULL DEFAULT false,
	`licenseActivatedAt` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contacts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `content_calendar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int,
	`title` varchar(240) NOT NULL,
	`contentType` enum('Article de Blog','Post Reseau Social','Newsletter','Video','Autre') NOT NULL,
	`publishDate` date,
	`status` enum('Idee','En Redaction','Planifie','Publie') NOT NULL DEFAULT 'Idee',
	`assignedTo` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_calendar_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`assignedTo` int,
	`campaignId` int,
	`title` varchar(240) NOT NULL,
	`amount` decimal(12,2) NOT NULL DEFAULT '0',
	`stage` enum('Prospection','Rendez-vous Place','Demo Effectuee','Devis Envoye','Gagne','Perdu') NOT NULL DEFAULT 'Prospection',
	`expectedCloseDate` date,
	`notes` text,
	`lossReason` text,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`targetDate` date,
	`status` enum('En Cours','Atteint','Non Atteint') NOT NULL DEFAULT 'En Cours',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int,
	`label` varchar(240) NOT NULL,
	`category` enum('Hebergement','Outils SaaS','Salaires','Marketing','Frais Generaux','Autre'),
	`amount` decimal(12,2) NOT NULL,
	`expenseDate` date NOT NULL,
	`isRecurring` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int NOT NULL,
	`assignedTo` int,
	`type` enum('Devis sans reponse','RDV a confirmer','Relance commerciale','Autre') NOT NULL DEFAULT 'Relance commerciale',
	`dueAt` timestamp NOT NULL,
	`status` enum('A faire','Effectuee','Annulee') NOT NULL DEFAULT 'A faire',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int,
	`contactId` int,
	`createdBy` int,
	`type` enum('Appel','Email','Reunion','Note') NOT NULL DEFAULT 'Note',
	`content` text NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internal_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`businessRole` enum('admin','direction','commercial','marketing','secretariat','finance') NOT NULL DEFAULT 'secretariat',
	`jobTitle` varchar(160),
	`hireDate` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `internal_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `internal_users_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `internal_users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`subscriptionId` int,
	`invoiceNumber` varchar(80) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`status` enum('Brouillon','Envoyee','Payee','En Retard') NOT NULL DEFAULT 'Brouillon',
	`dueDate` date,
	`paidAt` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_base_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`category` enum('Commercial','Support','Marketing','General') NOT NULL DEFAULT 'General',
	`content` text NOT NULL,
	`authorId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_base_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('Conges Payes','RTT','Maladie','Autre') NOT NULL DEFAULT 'Conges Payes',
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`status` enum('Demande','Valide','Refuse') NOT NULL DEFAULT 'Demande',
	`validatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leave_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int,
	`type` enum('CGU','CGV','DPA RGPD','Contrat Fournisseur','Certificat HDS','Statuts','Autre'),
	`version` varchar(60),
	`effectiveDate` date,
	`expiryDate` date,
	`fileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `legal_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(240) NOT NULL,
	`channel` enum('Email','Reseaux Sociaux','SEO-Contenu','Salon Professionnel','Webinaire','Publicite Payante','Autre') NOT NULL,
	`budget` decimal(12,2) NOT NULL DEFAULT '0',
	`startDate` date,
	`endDate` date,
	`status` enum('Planifiee','En Cours','Terminee') NOT NULL DEFAULT 'Planifiee',
	`ownerId` int,
	`leadsGenerated` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` enum('Commercial','Marketing','Succes Client','Support','Finance','Juridique','RH','Produit','Fournisseurs') DEFAULT 'Support',
	`message` text NOT NULL,
	`link` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(240) NOT NULL,
	`type` enum('Hopital Public','Clinique Privee','Groupement Hospitalier','Cabinet Liberal') NOT NULL,
	`address` text,
	`city` varchar(160),
	`postalCode` varchar(16),
	`status` enum('Prospect','En Demo','Negociation','Client Actif','Inactif') NOT NULL DEFAULT 'Prospect',
	`leadSource` enum('Site Web','Salon Professionnel','Recommandation','Prospection a Froid','LinkedIn','Reseau AGAPE','Autre') DEFAULT 'Autre',
	`annualContractValue` decimal(12,2) NOT NULL DEFAULT '0',
	`contractStartDate` date,
	`contractEndDate` date,
	`onboardingStatus` enum('Non Demarre','En Cours','Termine') NOT NULL DEFAULT 'Non Demarre',
	`healthScore` enum('Bon','A Surveiller','A Risque') NOT NULL DEFAULT 'Bon',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceTicketId` int,
	`organizationId` int,
	`title` varchar(240) NOT NULL,
	`description` text,
	`type` enum('Bug','Evolution') NOT NULL DEFAULT 'Evolution',
	`priority` enum('Basse','Moyenne','Haute') NOT NULL DEFAULT 'Moyenne',
	`status` enum('Idee','Backlog','En Developpement','Livre') NOT NULL DEFAULT 'Idee',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dealId` int NOT NULL,
	`quoteNumber` varchar(60) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`status` enum('Brouillon','Envoye','Vu','Signe','Expire','Refuse') NOT NULL DEFAULT 'Brouillon',
	`validUntil` date,
	`sentAt` timestamp,
	`signedAt` timestamp,
	`externalSignatureUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `quotes_quoteNumber_unique` UNIQUE(`quoteNumber`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`planName` varchar(160) NOT NULL,
	`seatsPurchased` int NOT NULL DEFAULT 1,
	`pricePerSeat` decimal(10,2) NOT NULL DEFAULT '0',
	`billingCycle` enum('Mensuel','Annuel') NOT NULL DEFAULT 'Mensuel',
	`status` enum('Essai','Actif','Suspendu','Resilie') NOT NULL DEFAULT 'Essai',
	`startDate` date,
	`renewalDate` date,
	`cancelledAt` date,
	`cancellationReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(240) NOT NULL,
	`category` enum('Hebergement','Outil SaaS Interne','Partenaire Commercial','Autre'),
	`contactName` varchar(200),
	`contactEmail` varchar(320),
	`annualCost` decimal(12,2) NOT NULL DEFAULT '0',
	`contractRenewalDate` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int,
	`contactId` int,
	`title` varchar(240) NOT NULL,
	`description` text,
	`category` enum('Facturation','Acces Licence','Support Technique','Onboarding','Autre') NOT NULL,
	`priority` enum('Basse','Moyenne','Haute','Urgente') NOT NULL DEFAULT 'Moyenne',
	`status` enum('Nouveau','En cours','En attente client','Resolu') NOT NULL DEFAULT 'Nouveau',
	`assignedTo` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`contactId` int,
	`documentsGeneratedCount` int NOT NULL DEFAULT 1,
	`logDate` date NOT NULL,
	CONSTRAINT `usage_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_tasks` ADD CONSTRAINT `admin_tasks_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_tasks` ADD CONSTRAINT `admin_tasks_assignedTo_internal_users_id_fk` FOREIGN KEY (`assignedTo`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_userId_internal_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_matchedInvoiceId_invoices_id_fk` FOREIGN KEY (`matchedInvoiceId`) REFERENCES `invoices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_matchedExpenseId_expenses_id_fk` FOREIGN KEY (`matchedExpenseId`) REFERENCES `expenses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_calendar` ADD CONSTRAINT `content_calendar_campaignId_marketing_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `marketing_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_calendar` ADD CONSTRAINT `content_calendar_assignedTo_internal_users_id_fk` FOREIGN KEY (`assignedTo`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deals` ADD CONSTRAINT `deals_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deals` ADD CONSTRAINT `deals_assignedTo_internal_users_id_fk` FOREIGN KEY (`assignedTo`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deals` ADD CONSTRAINT `deals_campaignId_marketing_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `marketing_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_goals` ADD CONSTRAINT `employee_goals_userId_internal_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `internal_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_supplierId_suppliers_id_fk` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_dealId_deals_id_fk` FOREIGN KEY (`dealId`) REFERENCES `deals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_assignedTo_internal_users_id_fk` FOREIGN KEY (`assignedTo`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_dealId_deals_id_fk` FOREIGN KEY (`dealId`) REFERENCES `deals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_createdBy_internal_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `internal_users` ADD CONSTRAINT `internal_users_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_base_articles` ADD CONSTRAINT `knowledge_base_articles_authorId_internal_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_userId_internal_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `internal_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_validatedBy_internal_users_id_fk` FOREIGN KEY (`validatedBy`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_documents` ADD CONSTRAINT `legal_documents_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_campaigns` ADD CONSTRAINT `marketing_campaigns_ownerId_internal_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_internal_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `internal_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_requests` ADD CONSTRAINT `product_requests_sourceTicketId_support_tickets_id_fk` FOREIGN KEY (`sourceTicketId`) REFERENCES `support_tickets`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_requests` ADD CONSTRAINT `product_requests_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quotes` ADD CONSTRAINT `quotes_dealId_deals_id_fk` FOREIGN KEY (`dealId`) REFERENCES `deals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_assignedTo_internal_users_id_fk` FOREIGN KEY (`assignedTo`) REFERENCES `internal_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_logs` ADD CONSTRAINT `usage_logs_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_logs` ADD CONSTRAINT `usage_logs_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contacts_organization_idx` ON `contacts` (`organizationId`);--> statement-breakpoint
CREATE INDEX `contacts_name_idx` ON `contacts` (`fullName`);--> statement-breakpoint
CREATE INDEX `deals_stage_idx` ON `deals` (`stage`);--> statement-breakpoint
CREATE INDEX `deals_organization_idx` ON `deals` (`organizationId`);--> statement-breakpoint
CREATE INDEX `interactions_deal_idx` ON `interactions` (`dealId`);--> statement-breakpoint
CREATE INDEX `interactions_contact_idx` ON `interactions` (`contactId`);--> statement-breakpoint
CREATE INDEX `organizations_status_idx` ON `organizations` (`status`);--> statement-breakpoint
CREATE INDEX `organizations_name_idx` ON `organizations` (`name`);