-- Medactio Pilotage — schéma cible Supabase/PostgreSQL
-- Socle V1 + tables V2 + extensions nécessaires au pôle Commercial & B2B.
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'direction', 'commercial', 'marketing', 'secretariat', 'finance');

create table public.internal_users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role public.user_role not null default 'secretariat',
  job_title text,
  hire_date date,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text check (type in ('Hopital Public','Clinique Privee','Groupement Hospitalier','Cabinet Liberal')),
  address text,
  city text,
  postal_code text,
  status text check (status in ('Prospect','En Demo','Negociation','Client Actif','Inactif')) default 'Prospect',
  lead_source text check (lead_source in ('Site Web','Salon Professionnel','Recommandation','Prospection a Froid','LinkedIn','Reseau AGAPE','Autre')),
  annual_contract_value numeric(12,2) not null default 0,
  contract_start_date date,
  contract_end_date date,
  onboarding_status text check (onboarding_status in ('Non Demarre','En Cours','Termine')) default 'Non Demarre',
  health_score text check (health_score in ('Bon','A Surveiller','A Risque')) default 'Bon',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organizations_status_idx on public.organizations(status);
create index organizations_name_idx on public.organizations(name);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null,
  email text unique not null,
  phone text,
  specialty text,
  job_title text,
  is_license_active boolean not null default false,
  license_activated_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_organization_idx on public.contacts(organization_id);

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text check (channel in ('Email','Reseaux Sociaux','SEO-Contenu','Salon Professionnel','Webinaire','Publicite Payante','Autre')),
  budget numeric(12,2) not null default 0,
  start_date date,
  end_date date,
  status text check (status in ('Planifiee','En Cours','Terminee')) default 'Planifiee',
  owner_id uuid references public.internal_users(id) on delete set null,
  leads_generated integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  title text not null,
  content_type text check (content_type in ('Article de Blog','Post Reseau Social','Newsletter','Video','Autre')),
  publish_date date,
  status text check (status in ('Idee','En Redaction','Planifie','Publie')) default 'Idee',
  assigned_to uuid references public.internal_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_to uuid references public.internal_users(id) on delete set null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null default 0,
  stage text check (stage in ('Prospection','Rendez-vous Place','Demo Effectuee','Devis Envoye','Gagne','Perdu')) default 'Prospection',
  expected_close_date date,
  notes text,
  loss_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deals_stage_idx on public.deals(stage);
create index deals_organization_idx on public.deals(organization_id);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  created_by uuid references public.internal_users(id) on delete set null,
  type text check (type in ('Appel','Email','Reunion','Note')) default 'Note',
  content text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index interactions_deal_idx on public.interactions(deal_id);
create index interactions_contact_idx on public.interactions(contact_id);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  quote_number text unique not null,
  amount numeric(12,2) not null,
  status text check (status in ('Brouillon','Envoye','Vu','Signe','Expire','Refuse')) default 'Brouillon',
  valid_until date,
  sent_at timestamptz,
  signed_at timestamptz,
  external_signature_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  assigned_to uuid references public.internal_users(id) on delete set null,
  type text check (type in ('Devis sans reponse','RDV a confirmer','Relance commerciale','Autre')) default 'Relance commerciale',
  due_at timestamptz not null,
  status text check (status in ('A faire','Effectuee','Annulee')) default 'A faire',
  note text,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_name text not null,
  seats_purchased integer not null default 1,
  price_per_seat numeric(10,2) not null default 0,
  billing_cycle text check (billing_cycle in ('Mensuel','Annuel')) default 'Mensuel',
  status text check (status in ('Essai','Actif','Suspendu','Resilie')) default 'Essai',
  start_date date,
  renewal_date date,
  cancelled_at date,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  invoice_number text unique not null,
  amount numeric(12,2) not null,
  status text check (status in ('Brouillon','Envoyee','Payee','En Retard')) default 'Brouillon',
  due_date date,
  paid_at date,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  description text,
  category text check (category in ('Facturation','Acces Licence','Support Technique','Onboarding','Autre')),
  priority text check (priority in ('Basse','Moyenne','Haute','Urgente')) default 'Moyenne',
  status text check (status in ('Nouveau','En cours','En attente client','Resolu')) default 'Nouveau',
  assigned_to uuid references public.internal_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  organization_id uuid references public.organizations(id) on delete set null,
  assigned_to uuid references public.internal_users(id) on delete set null,
  due_date date,
  status text check (status in ('A Faire','En Cours','Fait')) default 'A Faire',
  created_at timestamptz not null default now()
);

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  documents_generated_count integer not null default 1,
  log_date date not null default current_date
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.internal_users(id) on delete cascade,
  category text check (category in ('Commercial','Marketing','Succes Client','Support','Finance','Juridique','RH','Produit','Fournisseurs')) default 'Support',
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.internal_users(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text check (category in ('Hebergement','Outil SaaS Interne','Partenaire Commercial','Autre')),
  contact_name text,
  contact_email text,
  annual_cost numeric(12,2) not null default 0,
  contract_renewal_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  label text not null,
  category text check (category in ('Hebergement','Outils SaaS','Salaires','Marketing','Frais Generaux','Autre')),
  amount numeric(12,2) not null,
  expense_date date not null,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  amount numeric(12,2) not null,
  type text check (type in ('Credit','Debit')) not null,
  description text,
  matched_invoice_id uuid references public.invoices(id) on delete set null,
  matched_expense_id uuid references public.expenses(id) on delete set null,
  is_reconciled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  type text check (type in ('CGU','CGV','DPA RGPD','Contrat Fournisseur','Certificat HDS','Statuts','Autre')),
  version text,
  effective_date date,
  expiry_date date,
  file_url text,
  created_at timestamptz not null default now()
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.internal_users(id) on delete cascade,
  type text check (type in ('Conges Payes','RTT','Maladie','Autre')) default 'Conges Payes',
  start_date date not null,
  end_date date not null,
  status text check (status in ('Demande','Valide','Refuse')) default 'Demande',
  validated_by uuid references public.internal_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.employee_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.internal_users(id) on delete cascade,
  title text not null,
  target_date date,
  status text check (status in ('En Cours','Atteint','Non Atteint')) default 'En Cours',
  created_at timestamptz not null default now()
);

create table public.product_requests (
  id uuid primary key default gen_random_uuid(),
  source_ticket_id uuid references public.support_tickets(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  title text not null,
  description text,
  type text check (type in ('Bug','Evolution')) default 'Evolution',
  priority text check (priority in ('Basse','Moyenne','Haute')) default 'Moyenne',
  status text check (status in ('Idee','Backlog','En Developpement','Livre')) default 'Idee',
  created_at timestamptz not null default now()
);

create table public.changelog_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  release_date date,
  type text check (type in ('Nouvelle Fonctionnalite','Amelioration','Correction')) default 'Amelioration',
  created_at timestamptz not null default now()
);

create table public.knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text check (category in ('Commercial','Support','Marketing','General')) default 'General',
  content text not null,
  author_id uuid references public.internal_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.current_internal_role()
returns public.user_role language sql stable security definer set search_path = public
as $$ select role from public.internal_users where id = auth.uid() $$;

create or replace function public.is_internal()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.internal_users where id = auth.uid()) $$;

revoke all on function public.current_internal_role() from public;
revoke all on function public.is_internal() from public;
grant execute on function public.current_internal_role() to authenticated;
grant execute on function public.is_internal() to authenticated;

alter table public.internal_users enable row level security;
alter table public.organizations enable row level security;
alter table public.contacts enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.content_calendar enable row level security;
alter table public.deals enable row level security;
alter table public.interactions enable row level security;
alter table public.quotes enable row level security;
alter table public.follow_ups enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.support_tickets enable row level security;
alter table public.admin_tasks enable row level security;
alter table public.usage_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.legal_documents enable row level security;
alter table public.leave_requests enable row level security;
alter table public.employee_goals enable row level security;
alter table public.product_requests enable row level security;
alter table public.changelog_entries enable row level security;
alter table public.knowledge_base_articles enable row level security;

create policy internal_users_read on public.internal_users for select to authenticated using (public.is_internal());
create policy internal_users_self_update on public.internal_users for update to authenticated using (id = auth.uid() or public.current_internal_role() = 'admin') with check (id = auth.uid() or public.current_internal_role() = 'admin');

-- Lecture interne générale des données opérationnelles non financières.
do $$
declare table_name text;
begin
  foreach table_name in array array['organizations','contacts','marketing_campaigns','content_calendar','deals','interactions','quotes','follow_ups','support_tickets','admin_tasks','usage_logs','product_requests','changelog_entries','knowledge_base_articles']
  loop
    execute format('create policy internal_read on public.%I for select to authenticated using (public.is_internal())', table_name);
  end loop;
end $$;

-- Écriture CRM réservée aux commerciaux et administrateurs.
do $$
declare table_name text;
begin
  foreach table_name in array array['organizations','contacts','deals','interactions','quotes','follow_ups']
  loop
    execute format('create policy crm_write on public.%I for all to authenticated using (public.current_internal_role() in (''admin'',''commercial'')) with check (public.current_internal_role() in (''admin'',''commercial''))', table_name);
  end loop;
end $$;

create policy marketing_write on public.marketing_campaigns for all to authenticated using (public.current_internal_role() in ('admin','marketing')) with check (public.current_internal_role() in ('admin','marketing'));
create policy content_calendar_write on public.content_calendar for all to authenticated using (public.current_internal_role() in ('admin','marketing')) with check (public.current_internal_role() in ('admin','marketing'));
create policy support_write on public.support_tickets for all to authenticated using (public.current_internal_role() in ('admin','secretariat')) with check (public.current_internal_role() in ('admin','secretariat'));
create policy admin_tasks_write on public.admin_tasks for all to authenticated using (public.current_internal_role() in ('admin','secretariat')) with check (public.current_internal_role() in ('admin','secretariat'));

create policy subscriptions_read on public.subscriptions for select to authenticated using (public.current_internal_role() in ('admin','direction','commercial','finance'));
create policy subscriptions_write on public.subscriptions for all to authenticated using (public.current_internal_role() in ('admin','finance')) with check (public.current_internal_role() in ('admin','finance'));
create policy invoices_read on public.invoices for select to authenticated using (public.current_internal_role() in ('admin','direction','secretariat','finance'));
create policy invoices_write on public.invoices for all to authenticated using (public.current_internal_role() in ('admin','secretariat','finance')) with check (public.current_internal_role() in ('admin','secretariat','finance'));

create policy notifications_own on public.notifications for all to authenticated using (user_id = auth.uid() or public.current_internal_role() = 'admin') with check (user_id = auth.uid() or public.current_internal_role() = 'admin');
create policy audit_admin_read on public.audit_log for select to authenticated using (public.current_internal_role() in ('admin','direction'));
create policy audit_internal_insert on public.audit_log for insert to authenticated with check (public.is_internal());

create policy suppliers_read on public.suppliers for select to authenticated using (public.is_internal());
create policy suppliers_write on public.suppliers for all to authenticated using (public.current_internal_role() in ('admin','direction')) with check (public.current_internal_role() in ('admin','direction'));
create policy expenses_access on public.expenses for all to authenticated using (public.current_internal_role() in ('admin','direction','finance')) with check (public.current_internal_role() in ('admin','finance'));
create policy bank_access on public.bank_transactions for all to authenticated using (public.current_internal_role() in ('admin','direction','finance')) with check (public.current_internal_role() in ('admin','finance'));
create policy legal_read on public.legal_documents for select to authenticated using (public.is_internal());
create policy legal_write on public.legal_documents for all to authenticated using (public.current_internal_role() in ('admin','direction')) with check (public.current_internal_role() in ('admin','direction'));
create policy product_write on public.product_requests for all to authenticated using (public.current_internal_role() in ('admin','direction')) with check (public.current_internal_role() in ('admin','direction'));
create policy changelog_write on public.changelog_entries for all to authenticated using (public.current_internal_role() in ('admin','direction')) with check (public.current_internal_role() in ('admin','direction'));

create policy leave_own_or_management on public.leave_requests for all to authenticated using (user_id = auth.uid() or public.current_internal_role() in ('admin','direction')) with check (user_id = auth.uid() or public.current_internal_role() in ('admin','direction'));
create policy goals_own_or_management on public.employee_goals for all to authenticated using (user_id = auth.uid() or public.current_internal_role() in ('admin','direction')) with check (user_id = auth.uid() or public.current_internal_role() in ('admin','direction'));
create policy knowledge_write on public.knowledge_base_articles for all to authenticated using (author_id = auth.uid() or public.current_internal_role() in ('admin','direction')) with check (author_id = auth.uid() or public.current_internal_role() in ('admin','direction'));

create or replace function public.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(user_id, action, target_table, target_id)
  values (auth.uid(), tg_op, tg_table_name, coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create trigger audit_invoices after insert or update or delete on public.invoices for each row execute function public.audit_sensitive_change();
create trigger audit_subscriptions after insert or update or delete on public.subscriptions for each row execute function public.audit_sensitive_change();
create trigger audit_expenses after insert or update or delete on public.expenses for each row execute function public.audit_sensitive_change();
create trigger audit_bank_transactions after insert or update or delete on public.bank_transactions for each row execute function public.audit_sensitive_change();
create trigger audit_legal_documents after insert or update or delete on public.legal_documents for each row execute function public.audit_sensitive_change();
