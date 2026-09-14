-- =====================================================================
-- Medactio Pilotage — configuration Supabase
--
-- À exécuter UNE FOIS dans l'éditeur SQL du projet Supabase, APRÈS avoir
-- appliqué les migrations du schéma (`pnpm drizzle-kit migrate`).
--
-- Ce script fait deux choses :
--   1. verrouille l'accès direct aux tables via l'API publique de Supabase ;
--   2. planifie les deux traitements quotidiens d'alertes.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. VERROUILLAGE DE L'ACCÈS DIRECT (Row Level Security)
-- ---------------------------------------------------------------------
-- La clé `anon` est publique : elle est embarquée dans le JavaScript envoyé au
-- navigateur. Sans RLS, n'importe qui pourrait interroger l'API REST de
-- Supabase avec cette clé et lire l'intégralité des données.
--
-- On active donc RLS sur toutes les tables SANS définir la moindre politique :
-- l'API publique se voit alors refuser tout accès, en lecture comme en
-- écriture. L'application, qui se connecte directement à PostgreSQL avec le
-- rôle propriétaire, n'est pas affectée — les droits métier par rôle restent
-- appliqués côté serveur dans les routeurs tRPC.

alter table public."admin_tasks" enable row level security;
alter table public."audit_log" enable row level security;
alter table public."bank_transactions" enable row level security;
alter table public."calendar_events" enable row level security;
alter table public."changelog_entries" enable row level security;
alter table public."contacts" enable row level security;
alter table public."content_calendar" enable row level security;
alter table public."customer_alerts" enable row level security;
alter table public."customer_onboarding_tasks" enable row level security;
alter table public."customer_success_automations" enable row level security;
alter table public."deals" enable row level security;
alter table public."employee_goals" enable row level security;
alter table public."establishment_contracts" enable row level security;
alter table public."expenses" enable row level security;
alter table public."follow_ups" enable row level security;
alter table public."interactions" enable row level security;
alter table public."internal_users" enable row level security;
alter table public."invoices" enable row level security;
alter table public."knowledge_base_articles" enable row level security;
alter table public."leave_requests" enable row level security;
alter table public."legal_documents" enable row level security;
alter table public."marketing_assets" enable row level security;
alter table public."marketing_campaigns" enable row level security;
alter table public."marketing_events" enable row level security;
alter table public."marketing_leads" enable row level security;
alter table public."notifications" enable row level security;
alter table public."organizations" enable row level security;
alter table public."product_requests" enable row level security;
alter table public."quotes" enable row level security;
alter table public."subscriptions" enable row level security;
alter table public."suppliers" enable row level security;
alter table public."support_alerts" enable row level security;
alter table public."support_automations" enable row level security;
alter table public."support_ticket_events" enable row level security;
alter table public."support_tickets" enable row level security;
alter table public."usage_logs" enable row level security;
alter table public."users" enable row level security;

-- ---------------------------------------------------------------------
-- 2. TRAITEMENTS QUOTIDIENS (pg_cron)
-- ---------------------------------------------------------------------
-- Remplacez les deux valeurs ci-dessous avant d'exécuter :
--   <URL_APPLICATION> : URL publique de l'application, sans barre finale
--                       (ex. https://pilotage.medactio.fr)
--   <CRON_SECRET>     : valeur exacte de la variable CRON_SECRET du serveur
--
-- Les traitements sont idempotents et ne s'exécutent que si l'automatisation
-- correspondante est activée dans l'interface ; sinon l'appel est ignoré.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Alertes Succès Client — tous les jours à 06:00 UTC
select cron.schedule(
  'medactio-customer-success-alerts',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := '<URL_APPLICATION>/api/scheduled/customer-success-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Alertes Support — tous les jours à 06:30 UTC
select cron.schedule(
  'medactio-support-alerts',
  '30 6 * * *',
  $$
  select net.http_post(
    url     := '<URL_APPLICATION>/api/scheduled/support-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Vérifier les planifications :       select * from cron.job;
-- Consulter les dernières exécutions : select * from cron.job_run_details order by start_time desc limit 20;
-- Supprimer une planification :       select cron.unschedule('medactio-support-alerts');
