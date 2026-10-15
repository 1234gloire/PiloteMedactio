-- Pièces jointes des messages rédigés depuis la plateforme.
--
-- Le fichier lui-même va dans le compartiment de stockage ; la base ne retient
-- que sa cle et son rattachement. Une piece sans rattachement est un brouillon :
-- le televersement a eu lieu, l'envoi pas encore.
CREATE TABLE "email_attachments" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
  "storageKey" varchar(512) NOT NULL,
  "fileName" varchar(240) NOT NULL,
  "mimeType" varchar(160) NOT NULL,
  "sizeBytes" integer NOT NULL,
  "scheduledEmailId" integer REFERENCES "public"."scheduled_emails"("id") ON DELETE cascade,
  "interactionId" integer REFERENCES "public"."interactions"("id") ON DELETE cascade,
  "createdBy" integer REFERENCES "public"."internal_users"("id") ON DELETE set null,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_attachments_scheduled_idx" ON "email_attachments" ("scheduledEmailId");
--> statement-breakpoint
CREATE INDEX "email_attachments_interaction_idx" ON "email_attachments" ("interactionId");
--> statement-breakpoint
-- Brouillons abandonnes : reperables a l'absence de rattachement.
CREATE INDEX "email_attachments_orphan_idx" ON "email_attachments" ("createdAt")
  WHERE "scheduledEmailId" IS NULL AND "interactionId" IS NULL;
--> statement-breakpoint
ALTER TABLE "email_attachments" ENABLE ROW LEVEL SECURITY;
