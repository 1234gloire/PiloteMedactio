-- Medactio Pilotage — extension V1 Secrétariat & Support
-- Migration PostgreSQL/Supabase additive, à appliquer après 20260911_initial_schema.sql.

alter table public.support_tickets
  add column if not exists sla_due_at timestamptz,
  add column if not exists first_responded_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists support_tickets_status_idx on public.support_tickets(status);
create index if not exists support_tickets_sla_idx on public.support_tickets(sla_due_at);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.internal_users(id) on delete set null,
  event_type text not null default 'Commentaire' check (event_type in ('Commentaire','Changement Statut','Note Interne','Relance Client')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_ticket_events_ticket_idx on public.support_ticket_events(ticket_id);

alter table public.admin_tasks
  add column if not exists priority text not null default 'Moyenne' check (priority in ('Basse','Moyenne','Haute')),
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
create index if not exists admin_tasks_due_idx on public.admin_tasks(status, due_date);

alter table public.invoices
  add column if not exists issued_at date,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists last_reminder_at timestamptz,
  add column if not exists next_reminder_date date,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.establishment_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  type text not null default 'Contrat' check (type in ('Convention','Contrat','DPA','Avenant','Autre')),
  status text not null default 'Brouillon' check (status in ('Brouillon','A Signer','Actif','Expire','Resilie')),
  start_date date,
  end_date date,
  signed_at date,
  document_key text,
  document_url text,
  document_name text,
  document_mime_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists establishment_contracts_org_idx on public.establishment_contracts(organization_id);
create index if not exists establishment_contracts_end_idx on public.establishment_contracts(status, end_date);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'Rendez-vous Interne' check (event_type in ('Rendez-vous Interne','Demo','Rendez-vous Client','Echeance','Autre')),
  organization_id uuid references public.organizations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  organizer_id uuid references public.internal_users(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendar_events_start_idx on public.calendar_events(start_at);

create table if not exists public.support_alerts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('Ticket','Tache','Facture','Contrat','Evenement')),
  entity_id uuid not null,
  alert_type text not null check (alert_type in ('SLA Depasse','Echeance Tache','Facture Impayee','Contrat A Renouveler','Rendez-vous Proche')),
  severity text not null default 'Attention' check (severity in ('Info','Attention','Critique')),
  title text not null,
  message text not null,
  due_at timestamptz,
  link text,
  status text not null default 'Ouverte' check (status in ('Ouverte','Resolue','Ignoree')),
  dedupe_key text not null unique,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_alerts_status_due_idx on public.support_alerts(status, due_at);

create table if not exists public.support_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  schedule_cron_task_uid varchar(65) unique,
  enabled boolean not null default false,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_ticket_events enable row level security;
alter table public.establishment_contracts enable row level security;
alter table public.calendar_events enable row level security;
alter table public.support_alerts enable row level security;
alter table public.support_automations enable row level security;

create policy support_ticket_events_read on public.support_ticket_events for select to authenticated using (public.is_internal());
create policy support_ticket_events_write on public.support_ticket_events for all to authenticated using (public.current_internal_role() in ('admin','secretariat')) with check (public.current_internal_role() in ('admin','secretariat'));
create policy establishment_contracts_read on public.establishment_contracts for select to authenticated using (public.is_internal());
create policy establishment_contracts_write on public.establishment_contracts for all to authenticated using (public.current_internal_role() in ('admin','secretariat')) with check (public.current_internal_role() in ('admin','secretariat'));
create policy calendar_events_read on public.calendar_events for select to authenticated using (public.is_internal());
create policy calendar_events_write on public.calendar_events for all to authenticated using (public.current_internal_role() in ('admin','secretariat')) with check (public.current_internal_role() in ('admin','secretariat'));
create policy support_alerts_read on public.support_alerts for select to authenticated using (public.is_internal());
create policy support_alerts_write on public.support_alerts for all to authenticated using (public.current_internal_role() in ('admin','secretariat')) with check (public.current_internal_role() in ('admin','secretariat'));
create policy support_automations_read on public.support_automations for select to authenticated using (public.is_internal());
create policy support_automations_write on public.support_automations for all to authenticated using (public.current_internal_role() in ('admin','secretariat')) with check (public.current_internal_role() in ('admin','secretariat'));
