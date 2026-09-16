ALTER TABLE "legal_documents" ADD COLUMN "title" varchar(240);--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "documentKey" text;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "documentName" varchar(240);--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupeKey" varchar(240);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_dedupeKey_unique" UNIQUE("dedupeKey");