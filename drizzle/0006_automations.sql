CREATE TABLE "automations" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
  "key" varchar(64) NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "lastRunAt" timestamp with time zone,
  "lastStatus" varchar(16),
  "lastDetail" text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "automations_key_unique" UNIQUE("key")
);
--> statement-breakpoint
-- Reprise de l'etat des deux traitements deja planifies : leur activation et
-- leur derniere execution ne doivent pas etre perdues.
INSERT INTO "automations" ("key", "enabled", "lastRunAt")
SELECT 'daily-customer-success-alerts', "enabled", "lastRunAt"
FROM "customer_success_automations"
WHERE "name" = 'daily-customer-success-alerts'
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "automations" ("key", "enabled", "lastRunAt")
SELECT 'daily-support-alerts', "enabled", "lastRunAt"
FROM "support_automations"
WHERE "name" = 'daily-support-alerts'
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "automations" ("key") VALUES
  ('daily-customer-success-alerts'),
  ('daily-support-alerts'),
  ('daily-invoice-reminders'),
  ('daily-governance-watch')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
DROP TABLE "customer_success_automations";--> statement-breakpoint
DROP TABLE "support_automations";
