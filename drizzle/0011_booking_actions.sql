-- Liens d'action d'une reservation externe.
--
-- Ils etaient jusqu'ici noyes dans la description, en texte brut. Les sortir
-- en colonnes permet de les presenter comme des boutons, et laisse la
-- description a ce qu'un humain a reellement ecrit.
ALTER TABLE "calendar_events" ADD COLUMN "rescheduleUrl" text;
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "cancelUrl" text;
