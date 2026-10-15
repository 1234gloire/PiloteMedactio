-- Boite d'expedition d'un envoi programme : une relance partie a J+7 doit
-- sortir de la meme boite que celle choisie a la redaction.
ALTER TABLE "scheduled_emails" ADD COLUMN "senderKey" varchar(32);
