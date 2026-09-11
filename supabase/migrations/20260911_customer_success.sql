-- Medactio Pilotage — extension V1 Clients & Licences

create table public.customer_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_key text not null check (item_key in ('Compte Cree','Formation Effectuee','Premiers Ecrits Generes')),
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.internal_users(id) on delete set null,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, item_key)
);
create index customer_onboarding_org_idx on public.customer_onboarding_tasks(organization_id);

create table public.customer_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  type text not null check (type in ('Renouvellement','Sous Utilisation','Onboarding Bloque','Compte A Risque')),
  severity text not null default 'Attention' check (severity in ('Info','Attention','Critique')),
  title text not null,
  message text not null,
  due_date date,
  status text not null default 'Ouverte' check (status in ('Ouverte','Resolue','Ignoree')),
  dedupe_key text not null unique,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_alerts_org_idx on public.customer_alerts(organization_id);
create index customer_alerts_status_due_idx on public.customer_alerts(status, due_date);

create table public.customer_success_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  schedule_cron_task_uid varchar(65) unique,
  enabled boolean not null default false,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_onboarding_tasks enable row level security;
alter table public.customer_alerts enable row level security;
alter table public.customer_success_automations enable row level security;

create policy customer_onboarding_read on public.customer_onboarding_tasks
for select to authenticated using (public.is_internal());
create policy customer_onboarding_admin_write on public.customer_onboarding_tasks
for all to authenticated using (public.current_internal_role() = 'admin')
with check (public.current_internal_role() = 'admin');

create policy customer_alerts_read on public.customer_alerts
for select to authenticated using (public.is_internal());
create policy customer_alerts_admin_write on public.customer_alerts
for all to authenticated using (public.current_internal_role() = 'admin')
with check (public.current_internal_role() = 'admin');

create policy customer_automations_admin on public.customer_success_automations
for all to authenticated using (public.current_internal_role() = 'admin')
with check (public.current_internal_role() = 'admin');

create policy usage_admin_write on public.usage_logs
for all to authenticated using (public.current_internal_role() = 'admin')
with check (public.current_internal_role() = 'admin');

-- La table subscriptions reste administrable par admin et finance, conformément à la migration initiale.
-- Les activations de contacts et les écritures d’usage passent par le backend, qui applique le rôle admin.
