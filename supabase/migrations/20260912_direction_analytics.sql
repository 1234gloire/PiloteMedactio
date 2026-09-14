-- Medactio Pilotage — extension V1 Direction & Analytics
-- Migration PostgreSQL/Supabase additive, à appliquer après les migrations précédentes.

alter table public.usage_logs
  add column if not exists ai_requests_count integer not null default 0;

comment on column public.usage_logs.ai_requests_count is
  'Nombre agrégé de requêtes IA pour la date et l’organisation concernées.';
