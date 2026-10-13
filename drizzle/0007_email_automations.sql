-- Envoi automatique des modèles d'email : déclencheur et délai portés par le
-- modèle, file des envois programmés, et traitement planifié qui la vide.
ALTER TABLE "email_templates" ADD COLUMN "trigger" varchar(48);
--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "delayDays" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "scheduled_emails" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
  "templateId" integer REFERENCES "public"."email_templates"("id") ON DELETE set null,
  "trigger" varchar(48),
  "ticketId" integer REFERENCES "public"."support_tickets"("id") ON DELETE cascade,
  "dealId" integer REFERENCES "public"."deals"("id") ON DELETE cascade,
  "contactId" integer REFERENCES "public"."contacts"("id") ON DELETE set null,
  "toEmail" varchar(320) NOT NULL,
  "toName" varchar(240),
  "subject" varchar(240) NOT NULL,
  "body" text NOT NULL,
  "sendAt" timestamp with time zone NOT NULL,
  "status" varchar(16) DEFAULT 'Programme' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lastError" text,
  "sentAt" timestamp with time zone,
  "createdBy" integer REFERENCES "public"."internal_users"("id") ON DELETE set null,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scheduled_emails_due_idx" ON "scheduled_emails" ("status", "sendAt");
--> statement-breakpoint
CREATE INDEX "scheduled_emails_deal_idx" ON "scheduled_emails" ("dealId");
--> statement-breakpoint
CREATE INDEX "scheduled_emails_ticket_idx" ON "scheduled_emails" ("ticketId");
--> statement-breakpoint
ALTER TABLE "scheduled_emails" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Oubli de la migration 0003 : les modèles étaient la seule table ouverte à
-- PostgREST. RLS active sans politique, comme partout ailleurs.
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
INSERT INTO "automations" ("key") VALUES ('scheduled-emails') ON CONFLICT ("key") DO NOTHING;
