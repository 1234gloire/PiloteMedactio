-- Reservations venues de Calendly.
--
-- `externalId` porte l'identifiant Calendly de l'evenement : il rend le
-- traitement idempotent, un meme appel rejoue ne creant pas deux rendez-vous.
ALTER TABLE "calendar_events" ADD COLUMN "externalSource" varchar(32);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "externalId" varchar(240);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "meetingUrl" text;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_externalId_unique" UNIQUE("externalId");
