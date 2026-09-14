-- Medactio Pilotage — extension V1 Marketing & Contenu
-- Migration PostgreSQL/Supabase additive, à appliquer après les migrations V1 précédentes.

alter table public.marketing_campaigns
  add column if not exists objective text,
  add column if not exists target_leads integer not null default 0,
  add column if not exists attributed_revenue numeric(12,2) not null default 0;

alter table public.content_calendar
  add column if not exists brief text,
  add column if not exists target_audience text,
  add column if not exists draft_content text,
  add column if not exists publication_url text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  job_title text,
  organization_name text not null,
  organization_type text check (organization_type in ('Hopital Public','Clinique Privee','Groupement Hospitalier','Cabinet Liberal')) default 'Cabinet Liberal',
  status text check (status in ('Nouveau','Qualifie','RDV Planifie','Converti','Rejete')) default 'Nouveau',
  source text check (source in ('Site Web','Import','Evenement','Manuel')) default 'Site Web',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  consent_to_contact boolean not null default false,
  notes text,
  qualified_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_leads_campaign_idx on public.marketing_leads(campaign_id);
create index if not exists marketing_leads_status_idx on public.marketing_leads(status);
create index if not exists marketing_leads_email_idx on public.marketing_leads(email);

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  title text not null,
  event_type text check (event_type in ('Webinaire','Demo Collective','Salon','Atelier')) default 'Webinaire',
  scheduled_at timestamptz not null,
  registration_count integer not null default 0,
  attendee_count integer not null default 0,
  meetings_booked integer not null default 0,
  status text check (status in ('Planifie','Termine','Annule')) default 'Planifie',
  meeting_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_events_campaign_idx on public.marketing_events(campaign_id);
create index if not exists marketing_events_date_idx on public.marketing_events(scheduled_at);

create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  title text not null,
  asset_type text check (asset_type in ('Plaquette','Argumentaire','Etude de Cas','Presentation','Visuel','Autre')) default 'Autre',
  description text,
  storage_key text not null,
  file_url text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  created_by uuid references public.internal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_assets_campaign_idx on public.marketing_assets(campaign_id);
create index if not exists marketing_assets_type_idx on public.marketing_assets(asset_type);

alter table public.marketing_leads enable row level security;
alter table public.marketing_events enable row level security;
alter table public.marketing_assets enable row level security;

create policy marketing_leads_read on public.marketing_leads for select to authenticated
  using (public.current_internal_role() in ('admin','direction','marketing','commercial'));
create policy marketing_leads_write on public.marketing_leads for all to authenticated
  using (public.current_internal_role() in ('admin','marketing'))
  with check (public.current_internal_role() in ('admin','marketing'));

create policy marketing_events_read on public.marketing_events for select to authenticated
  using (public.current_internal_role() in ('admin','direction','marketing','commercial'));
create policy marketing_events_write on public.marketing_events for all to authenticated
  using (public.current_internal_role() in ('admin','marketing'))
  with check (public.current_internal_role() in ('admin','marketing'));

create policy marketing_assets_read on public.marketing_assets for select to authenticated
  using (public.current_internal_role() in ('admin','direction','marketing','commercial','secretariat'));
create policy marketing_assets_write on public.marketing_assets for all to authenticated
  using (public.current_internal_role() in ('admin','marketing'))
  with check (public.current_internal_role() in ('admin','marketing'));

-- La capture publique est servie par l’API applicative /api/public/marketing/leads.
-- Elle applique validation, honeypot, consentement explicite et déduplication avant d’écrire avec le rôle serveur.
