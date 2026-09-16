ALTER TABLE "marketing_leads" ALTER COLUMN "organizationType" SET DEFAULT 'Autre';--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "source" varchar(32) DEFAULT 'Interne' NOT NULL;