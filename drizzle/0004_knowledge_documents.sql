ALTER TABLE "knowledge_base_articles" ALTER COLUMN "category" SET DEFAULT 'INT';--> statement-breakpoint
ALTER TABLE "knowledge_base_articles" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_base_articles" ADD COLUMN "documentKey" text;--> statement-breakpoint
ALTER TABLE "knowledge_base_articles" ADD COLUMN "documentName" varchar(240);--> statement-breakpoint
ALTER TABLE "knowledge_base_articles" ADD COLUMN "documentMimeType" varchar(160);