CREATE TABLE "admin_tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar(240) NOT NULL,
	"description" text,
	"organizationId" integer,
	"assignedTo" integer,
	"dueDate" date,
	"priority" varchar(32) DEFAULT 'Moyenne' NOT NULL,
	"status" varchar(32) DEFAULT 'A Faire' NOT NULL,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer,
	"action" varchar(160) NOT NULL,
	"targetTable" varchar(120),
	"targetId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transactionDate" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" varchar(32) NOT NULL,
	"description" text,
	"matchedInvoiceId" integer,
	"matchedExpenseId" integer,
	"isReconciled" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "calendar_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar(240) NOT NULL,
	"description" text,
	"eventType" varchar(48) DEFAULT 'Rendez-vous Interne' NOT NULL,
	"organizationId" integer,
	"contactId" integer,
	"organizerId" integer,
	"startAt" timestamp with time zone NOT NULL,
	"endAt" timestamp with time zone,
	"allDay" boolean DEFAULT false NOT NULL,
	"location" varchar(240),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "changelog_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar(240) NOT NULL,
	"description" text,
	"releaseDate" date,
	"type" varchar(48) DEFAULT 'Amelioration' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "contacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(40),
	"specialty" varchar(160),
	"jobTitle" varchar(200),
	"isLicenseActive" boolean DEFAULT false NOT NULL,
	"licenseActivatedAt" date,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "content_calendar" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "content_calendar_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campaignId" integer,
	"title" varchar(240) NOT NULL,
	"contentType" varchar(48) NOT NULL,
	"brief" text,
	"targetAudience" varchar(240),
	"draftContent" text,
	"publishDate" date,
	"publicationUrl" text,
	"status" varchar(32) DEFAULT 'Idee' NOT NULL,
	"assignedTo" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_alerts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer NOT NULL,
	"subscriptionId" integer,
	"type" varchar(48) NOT NULL,
	"severity" varchar(32) DEFAULT 'Attention' NOT NULL,
	"title" varchar(240) NOT NULL,
	"message" text NOT NULL,
	"dueDate" date,
	"status" varchar(32) DEFAULT 'Ouverte' NOT NULL,
	"dedupeKey" varchar(240) NOT NULL,
	"resolvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_alerts_dedupeKey_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "customer_onboarding_tasks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_onboarding_tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer NOT NULL,
	"itemKey" varchar(48) NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp with time zone,
	"completedBy" integer,
	"note" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_success_automations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_success_automations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(120) NOT NULL,
	"scheduleCronTaskUid" varchar(65),
	"enabled" boolean DEFAULT false NOT NULL,
	"lastRunAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_success_automations_name_unique" UNIQUE("name"),
	CONSTRAINT "customer_success_automations_scheduleCronTaskUid_unique" UNIQUE("scheduleCronTaskUid")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer NOT NULL,
	"assignedTo" integer,
	"campaignId" integer,
	"title" varchar(240) NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stage" varchar(48) DEFAULT 'Prospection' NOT NULL,
	"expectedCloseDate" date,
	"notes" text,
	"lossReason" text,
	"closedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_goals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "employee_goals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"title" varchar(240) NOT NULL,
	"targetDate" date,
	"status" varchar(32) DEFAULT 'En Cours' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "establishment_contracts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "establishment_contracts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer NOT NULL,
	"title" varchar(240) NOT NULL,
	"type" varchar(32) DEFAULT 'Contrat' NOT NULL,
	"status" varchar(32) DEFAULT 'Brouillon' NOT NULL,
	"startDate" date,
	"endDate" date,
	"signedAt" date,
	"documentKey" text,
	"documentUrl" text,
	"documentName" varchar(240),
	"documentMimeType" varchar(120),
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"supplierId" integer,
	"label" varchar(240) NOT NULL,
	"category" varchar(32),
	"amount" numeric(12, 2) NOT NULL,
	"expenseDate" date NOT NULL,
	"isRecurring" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "follow_ups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dealId" integer NOT NULL,
	"assignedTo" integer,
	"type" varchar(48) DEFAULT 'Relance commerciale' NOT NULL,
	"dueAt" timestamp with time zone NOT NULL,
	"status" varchar(32) DEFAULT 'A faire' NOT NULL,
	"note" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "interactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dealId" integer,
	"contactId" integer,
	"createdBy" integer,
	"type" varchar(32) DEFAULT 'Note' NOT NULL,
	"content" text NOT NULL,
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "internal_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"businessRole" varchar(32) DEFAULT 'secretariat' NOT NULL,
	"jobTitle" varchar(160),
	"hireDate" date,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "internal_users_userId_unique" UNIQUE("userId"),
	CONSTRAINT "internal_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer NOT NULL,
	"subscriptionId" integer,
	"invoiceNumber" varchar(80) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(32) DEFAULT 'Brouillon' NOT NULL,
	"issuedAt" date,
	"dueDate" date,
	"paidAt" date,
	"reminderCount" integer DEFAULT 0 NOT NULL,
	"lastReminderAt" timestamp with time zone,
	"nextReminderDate" date,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoiceNumber_unique" UNIQUE("invoiceNumber")
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_articles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "knowledge_base_articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" varchar(240) NOT NULL,
	"category" varchar(32) DEFAULT 'General' NOT NULL,
	"content" text NOT NULL,
	"authorId" integer,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leave_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"type" varchar(32) DEFAULT 'Conges Payes' NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"status" varchar(32) DEFAULT 'Demande' NOT NULL,
	"validatedBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "legal_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer,
	"type" varchar(48),
	"version" varchar(60),
	"effectiveDate" date,
	"expiryDate" date,
	"fileUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_assets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "marketing_assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campaignId" integer,
	"title" varchar(240) NOT NULL,
	"assetType" varchar(32) DEFAULT 'Autre' NOT NULL,
	"description" text,
	"storageKey" text NOT NULL,
	"fileUrl" text NOT NULL,
	"fileName" varchar(240) NOT NULL,
	"mimeType" varchar(160) NOT NULL,
	"sizeBytes" integer DEFAULT 0 NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "marketing_campaigns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(240) NOT NULL,
	"channel" varchar(48) NOT NULL,
	"objective" text,
	"budget" numeric(12, 2) DEFAULT '0' NOT NULL,
	"targetLeads" integer DEFAULT 0 NOT NULL,
	"attributedRevenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"startDate" date,
	"endDate" date,
	"status" varchar(32) DEFAULT 'Planifiee' NOT NULL,
	"ownerId" integer,
	"leadsGenerated" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "marketing_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campaignId" integer,
	"title" varchar(240) NOT NULL,
	"eventType" varchar(32) DEFAULT 'Webinaire' NOT NULL,
	"scheduledAt" timestamp with time zone NOT NULL,
	"registrationCount" integer DEFAULT 0 NOT NULL,
	"attendeeCount" integer DEFAULT 0 NOT NULL,
	"meetingsBooked" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'Planifie' NOT NULL,
	"meetingUrl" text,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_leads" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "marketing_leads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"campaignId" integer,
	"organizationId" integer,
	"contactId" integer,
	"dealId" integer,
	"fullName" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(40),
	"jobTitle" varchar(200),
	"organizationName" varchar(240) NOT NULL,
	"organizationType" varchar(48) DEFAULT 'Cabinet Liberal' NOT NULL,
	"status" varchar(32) DEFAULT 'Nouveau' NOT NULL,
	"source" varchar(32) DEFAULT 'Site Web' NOT NULL,
	"utmSource" varchar(160),
	"utmMedium" varchar(160),
	"utmCampaign" varchar(240),
	"consentToContact" boolean DEFAULT false NOT NULL,
	"notes" text,
	"qualifiedAt" timestamp with time zone,
	"convertedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"category" varchar(32) DEFAULT 'Support',
	"message" text NOT NULL,
	"link" text,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "organizations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(240) NOT NULL,
	"type" varchar(48) NOT NULL,
	"address" text,
	"city" varchar(160),
	"postalCode" varchar(16),
	"status" varchar(32) DEFAULT 'Prospect' NOT NULL,
	"leadSource" varchar(48) DEFAULT 'Autre',
	"annualContractValue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"contractStartDate" date,
	"contractEndDate" date,
	"onboardingStatus" varchar(32) DEFAULT 'Non Demarre' NOT NULL,
	"healthScore" varchar(32) DEFAULT 'Bon' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sourceTicketId" integer,
	"organizationId" integer,
	"title" varchar(240) NOT NULL,
	"description" text,
	"type" varchar(32) DEFAULT 'Evolution' NOT NULL,
	"priority" varchar(32) DEFAULT 'Moyenne' NOT NULL,
	"status" varchar(48) DEFAULT 'Idee' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quotes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dealId" integer NOT NULL,
	"quoteNumber" varchar(60) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(32) DEFAULT 'Brouillon' NOT NULL,
	"validUntil" date,
	"sentAt" timestamp with time zone,
	"signedAt" timestamp with time zone,
	"externalSignatureUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_quoteNumber_unique" UNIQUE("quoteNumber")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer NOT NULL,
	"planName" varchar(160) NOT NULL,
	"seatsPurchased" integer DEFAULT 1 NOT NULL,
	"pricePerSeat" numeric(10, 2) DEFAULT '0' NOT NULL,
	"billingCycle" varchar(32) DEFAULT 'Mensuel' NOT NULL,
	"status" varchar(32) DEFAULT 'Essai' NOT NULL,
	"startDate" date,
	"renewalDate" date,
	"cancelledAt" date,
	"cancellationReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "suppliers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(240) NOT NULL,
	"category" varchar(48),
	"contactName" varchar(200),
	"contactEmail" varchar(320),
	"annualCost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"contractRenewalDate" date,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_alerts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entityType" varchar(32) NOT NULL,
	"entityId" integer NOT NULL,
	"alertType" varchar(48) NOT NULL,
	"severity" varchar(32) DEFAULT 'Attention' NOT NULL,
	"title" varchar(240) NOT NULL,
	"message" text NOT NULL,
	"dueAt" timestamp with time zone,
	"link" text,
	"status" varchar(32) DEFAULT 'Ouverte' NOT NULL,
	"dedupeKey" varchar(240) NOT NULL,
	"resolvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_alerts_dedupeKey_unique" UNIQUE("dedupeKey")
);
--> statement-breakpoint
CREATE TABLE "support_automations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_automations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(120) NOT NULL,
	"scheduleCronTaskUid" varchar(65),
	"enabled" boolean DEFAULT false NOT NULL,
	"lastRunAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_automations_name_unique" UNIQUE("name"),
	CONSTRAINT "support_automations_scheduleCronTaskUid_unique" UNIQUE("scheduleCronTaskUid")
);
--> statement-breakpoint
CREATE TABLE "support_ticket_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_ticket_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ticketId" integer NOT NULL,
	"authorId" integer,
	"eventType" varchar(48) DEFAULT 'Commentaire' NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "support_tickets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer,
	"contactId" integer,
	"title" varchar(240) NOT NULL,
	"description" text,
	"category" varchar(48) NOT NULL,
	"priority" varchar(32) DEFAULT 'Moyenne' NOT NULL,
	"status" varchar(48) DEFAULT 'Nouveau' NOT NULL,
	"assignedTo" integer,
	"slaDueAt" timestamp with time zone,
	"firstRespondedAt" timestamp with time zone,
	"resolvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "usage_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organizationId" integer NOT NULL,
	"contactId" integer,
	"documentsGeneratedCount" integer DEFAULT 1 NOT NULL,
	"aiRequestsCount" integer DEFAULT 0 NOT NULL,
	"logDate" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "admin_tasks" ADD CONSTRAINT "admin_tasks_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_tasks" ADD CONSTRAINT "admin_tasks_assignedTo_internal_users_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_internal_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedInvoiceId_invoices_id_fk" FOREIGN KEY ("matchedInvoiceId") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedExpenseId_expenses_id_fk" FOREIGN KEY ("matchedExpenseId") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_contactId_contacts_id_fk" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organizerId_internal_users_id_fk" FOREIGN KEY ("organizerId") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_calendar" ADD CONSTRAINT "content_calendar_campaignId_marketing_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_calendar" ADD CONSTRAINT "content_calendar_assignedTo_internal_users_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_alerts" ADD CONSTRAINT "customer_alerts_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_alerts" ADD CONSTRAINT "customer_alerts_subscriptionId_subscriptions_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_onboarding_tasks" ADD CONSTRAINT "customer_onboarding_tasks_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_onboarding_tasks" ADD CONSTRAINT "customer_onboarding_tasks_completedBy_internal_users_id_fk" FOREIGN KEY ("completedBy") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_assignedTo_internal_users_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_campaignId_marketing_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_goals" ADD CONSTRAINT "employee_goals_userId_internal_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."internal_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "establishment_contracts" ADD CONSTRAINT "establishment_contracts_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplierId_suppliers_id_fk" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_dealId_deals_id_fk" FOREIGN KEY ("dealId") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assignedTo_internal_users_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_dealId_deals_id_fk" FOREIGN KEY ("dealId") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contactId_contacts_id_fk" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_createdBy_internal_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_users" ADD CONSTRAINT "internal_users_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_subscriptions_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_articles" ADD CONSTRAINT "knowledge_base_articles_authorId_internal_users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_userId_internal_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."internal_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_validatedBy_internal_users_id_fk" FOREIGN KEY ("validatedBy") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_campaignId_marketing_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_createdBy_internal_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_ownerId_internal_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_campaignId_marketing_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_leads" ADD CONSTRAINT "marketing_leads_campaignId_marketing_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."marketing_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_leads" ADD CONSTRAINT "marketing_leads_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_leads" ADD CONSTRAINT "marketing_leads_contactId_contacts_id_fk" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_leads" ADD CONSTRAINT "marketing_leads_dealId_deals_id_fk" FOREIGN KEY ("dealId") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_internal_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."internal_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_sourceTicketId_support_tickets_id_fk" FOREIGN KEY ("sourceTicketId") REFERENCES "public"."support_tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_requests" ADD CONSTRAINT "product_requests_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_dealId_deals_id_fk" FOREIGN KEY ("dealId") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_events" ADD CONSTRAINT "support_ticket_events_ticketId_support_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_ticket_events" ADD CONSTRAINT "support_ticket_events_authorId_internal_users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_contactId_contacts_id_fk" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedTo_internal_users_id_fk" FOREIGN KEY ("assignedTo") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_organizationId_organizations_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_contactId_contacts_id_fk" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_tasks_due_idx" ON "admin_tasks" USING btree ("status","dueDate");--> statement-breakpoint
CREATE INDEX "calendar_events_start_idx" ON "calendar_events" USING btree ("startAt");--> statement-breakpoint
CREATE INDEX "contacts_organization_idx" ON "contacts" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "contacts_name_idx" ON "contacts" USING btree ("fullName");--> statement-breakpoint
CREATE INDEX "customer_alerts_org_idx" ON "customer_alerts" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "customer_alerts_status_due_idx" ON "customer_alerts" USING btree ("status","dueDate");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_onboarding_org_item_unique" ON "customer_onboarding_tasks" USING btree ("organizationId","itemKey");--> statement-breakpoint
CREATE INDEX "customer_onboarding_org_idx" ON "customer_onboarding_tasks" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deals_organization_idx" ON "deals" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "establishment_contracts_org_idx" ON "establishment_contracts" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "establishment_contracts_end_idx" ON "establishment_contracts" USING btree ("status","endDate");--> statement-breakpoint
CREATE INDEX "interactions_deal_idx" ON "interactions" USING btree ("dealId");--> statement-breakpoint
CREATE INDEX "interactions_contact_idx" ON "interactions" USING btree ("contactId");--> statement-breakpoint
CREATE INDEX "marketing_assets_campaign_idx" ON "marketing_assets" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "marketing_assets_type_idx" ON "marketing_assets" USING btree ("assetType");--> statement-breakpoint
CREATE INDEX "marketing_events_campaign_idx" ON "marketing_events" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "marketing_events_date_idx" ON "marketing_events" USING btree ("scheduledAt");--> statement-breakpoint
CREATE INDEX "marketing_leads_campaign_idx" ON "marketing_leads" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "marketing_leads_status_idx" ON "marketing_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketing_leads_email_idx" ON "marketing_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "support_alerts_status_due_idx" ON "support_alerts" USING btree ("status","dueAt");--> statement-breakpoint
CREATE INDEX "support_ticket_events_ticket_idx" ON "support_ticket_events" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_tickets_sla_idx" ON "support_tickets" USING btree ("slaDueAt");