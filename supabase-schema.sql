-- ============================================================================
-- Sell Insights — Amazon Seller Audit Dashboard
-- Supabase schema reference. Run this in the Supabase SQL editor (or via the
-- CLI: `supabase db push`) against a fresh project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- brands
-- ----------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists brands_created_by_idx on public.brands (created_by);

-- ----------------------------------------------------------------------------
-- audits
-- ----------------------------------------------------------------------------
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'processing', 'complete')),
  marketplace text not null default 'US',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Re-runnable against a database that already has this table from before
-- marketplace/updated_at existed — CREATE TABLE IF NOT EXISTS above is a
-- no-op there. The DEFAULTs backfill every pre-existing row automatically.
alter table public.audits add column if not exists marketplace text not null default 'US';
alter table public.audits add column if not exists updated_at timestamptz not null default now();

create index if not exists audits_brand_id_idx on public.audits (brand_id);
create index if not exists audits_created_by_idx on public.audits (created_by);

-- Bumps updated_at on every row change (status transitions, future edit
-- features, etc.) — the audit dashboard's cache-invalidation check compares
-- this against the cached value to detect changes made elsewhere.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists audits_set_updated_at on public.audits;
create trigger audits_set_updated_at
  before update on public.audits
  for each row
  execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- audit_files — one row per uploaded source file
-- ----------------------------------------------------------------------------
create table if not exists public.audit_files (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  file_type text not null check (
    file_type in ('business_report', 'bulk_ads', 'sqp', 'brand_keywords', 'top_keywords')
  ),
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists audit_files_audit_id_idx on public.audit_files (audit_id);

-- ----------------------------------------------------------------------------
-- business_report_data — Business Report (single sheet), one row per child ASIN
-- ----------------------------------------------------------------------------
create table if not exists public.business_report_data (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  parent_asin text,
  child_asin text,
  title text,
  sessions_total int,
  session_percentage_total numeric,
  page_views_total int,
  page_views_percentage_total numeric,
  buy_box_percentage numeric,
  units_ordered int,
  unit_session_percentage numeric,
  ordered_product_sales numeric,
  total_order_items int
);

create index if not exists business_report_data_audit_id_idx on public.business_report_data (audit_id);
create index if not exists business_report_data_child_asin_idx on public.business_report_data (audit_id, child_asin);

-- ----------------------------------------------------------------------------
-- sp_campaign_data — "Sponsored Products Campaigns" tab of the Bulk Ads file
-- ----------------------------------------------------------------------------
create table if not exists public.sp_campaign_data (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  entity text,
  campaign_id text,
  campaign_name text,
  ad_group_name text,
  targeting_type text,
  state text,
  asin text,
  sku text,
  match_type text,
  bidding_strategy text,
  placement text,
  product_targeting_expression text,
  final_match_type text,
  impressions int,
  clicks int,
  ctr numeric,
  spend numeric,
  sales numeric,
  orders int,
  units int,
  conversion_rate numeric,
  acos numeric,
  cpc numeric,
  roas numeric
);

create index if not exists sp_campaign_data_audit_id_idx on public.sp_campaign_data (audit_id);
create index if not exists sp_campaign_data_entity_idx on public.sp_campaign_data (audit_id, entity);
create index if not exists sp_campaign_data_asin_idx on public.sp_campaign_data (audit_id, asin);

-- ----------------------------------------------------------------------------
-- sb_campaign_data — "Sponsored Brands Campaigns" tab
-- (no targeting_type / sku / ad_group_name / bidding_strategy / placement)
-- ----------------------------------------------------------------------------
create table if not exists public.sb_campaign_data (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  entity text,
  campaign_id text,
  campaign_name text,
  state text,
  asin text,
  match_type text,
  product_targeting_expression text,
  final_match_type text,
  impressions int,
  clicks int,
  ctr numeric,
  spend numeric,
  sales numeric,
  orders int,
  units int,
  conversion_rate numeric,
  acos numeric,
  cpc numeric,
  roas numeric
);

create index if not exists sb_campaign_data_audit_id_idx on public.sb_campaign_data (audit_id);
create index if not exists sb_campaign_data_entity_idx on public.sb_campaign_data (audit_id, entity);

-- ----------------------------------------------------------------------------
-- sd_campaign_data — "Sponsored Display Campaigns" tab
-- (no match_type / product_targeting_expression / final_match_type /
--  bidding_strategy / placement)
-- ----------------------------------------------------------------------------
create table if not exists public.sd_campaign_data (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  entity text,
  campaign_id text,
  campaign_name text,
  ad_group_name text,
  targeting_type text,
  state text,
  asin text,
  sku text,
  cost_type text,
  impressions int,
  clicks int,
  ctr numeric,
  spend numeric,
  sales numeric,
  orders int,
  units int,
  conversion_rate numeric,
  acos numeric,
  cpc numeric,
  roas numeric
);

-- Re-runnable against a database that already has this table from before
-- cost_type existed — CREATE TABLE IF NOT EXISTS above is a no-op there.
alter table public.sd_campaign_data add column if not exists cost_type text;

create index if not exists sd_campaign_data_audit_id_idx on public.sd_campaign_data (audit_id);
create index if not exists sd_campaign_data_entity_idx on public.sd_campaign_data (audit_id, entity);

-- ----------------------------------------------------------------------------
-- sp_search_term_data — "SP Search Term Report" tab
-- ----------------------------------------------------------------------------
create table if not exists public.sp_search_term_data (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  campaign_name text,
  ad_group_name text,
  keyword_text text,
  match_type text,
  product_targeting_expression text,
  final_match_type text,
  customer_search_term text,
  search_term_type text check (search_term_type in ('keyword', 'asin')),
  impressions int,
  clicks int,
  ctr numeric,
  spend numeric,
  sales numeric,
  orders int,
  units int,
  conversion_rate numeric,
  acos numeric,
  cpc numeric,
  roas numeric
);

create index if not exists sp_search_term_data_audit_id_idx on public.sp_search_term_data (audit_id);
create index if not exists sp_search_term_data_final_match_type_idx on public.sp_search_term_data (audit_id, final_match_type);

-- ----------------------------------------------------------------------------
-- sb_search_term_data — "SB Search Term Report" tab (same shape as SP)
-- ----------------------------------------------------------------------------
create table if not exists public.sb_search_term_data (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  campaign_name text,
  ad_group_name text,
  keyword_text text,
  match_type text,
  product_targeting_expression text,
  final_match_type text,
  customer_search_term text,
  search_term_type text check (search_term_type in ('keyword', 'asin')),
  impressions int,
  clicks int,
  ctr numeric,
  spend numeric,
  sales numeric,
  orders int,
  units int,
  conversion_rate numeric,
  acos numeric,
  cpc numeric,
  roas numeric
);

create index if not exists sb_search_term_data_audit_id_idx on public.sb_search_term_data (audit_id);
create index if not exists sb_search_term_data_final_match_type_idx on public.sb_search_term_data (audit_id, final_match_type);

-- ----------------------------------------------------------------------------
-- brand_keywords — user-supplied list used for branded/non-branded classification
-- ----------------------------------------------------------------------------
create table if not exists public.brand_keywords (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  keyword text not null
);

create index if not exists brand_keywords_audit_id_idx on public.brand_keywords (audit_id);

-- ----------------------------------------------------------------------------
-- audit_notes — free-text notes per dashboard section (one row per
-- audit_id + section_key, e.g. "summary_overall_performance"). The
-- unique constraint below also serves as the audit_id lookup index — a
-- separate index would just be a redundant prefix of the same btree.
-- ----------------------------------------------------------------------------
create table if not exists public.audit_notes (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  section_key text not null,
  content text default '',
  updated_at timestamptz default now(),
  unique (audit_id, section_key)
);

-- ============================================================================
-- Row Level Security
--
-- Team-wide access: any authenticated user can see and modify every row, not
-- just rows they created. This is a shared workspace, not a per-user silo —
-- `created_by` stays on brands/audits for attribution only, it no longer
-- gates visibility. Every policy below is `drop policy if exists` +
-- `create policy` so this section is safe to re-run against a database that
-- was originally provisioned with the old owner-only policies.
-- ============================================================================
alter table public.brands enable row level security;
alter table public.audits enable row level security;
alter table public.audit_files enable row level security;
alter table public.business_report_data enable row level security;
alter table public.sp_campaign_data enable row level security;
alter table public.sb_campaign_data enable row level security;
alter table public.sd_campaign_data enable row level security;
alter table public.sp_search_term_data enable row level security;
alter table public.sb_search_term_data enable row level security;
alter table public.brand_keywords enable row level security;
alter table public.audit_notes enable row level security;

-- brands: any authenticated user
drop policy if exists "brands_select_own" on public.brands;
create policy "brands_select_own" on public.brands
  for select using (auth.role() = 'authenticated');
drop policy if exists "brands_insert_own" on public.brands;
create policy "brands_insert_own" on public.brands
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "brands_update_own" on public.brands;
create policy "brands_update_own" on public.brands
  for update using (auth.role() = 'authenticated');
drop policy if exists "brands_delete_own" on public.brands;
create policy "brands_delete_own" on public.brands
  for delete using (auth.role() = 'authenticated');

-- audits: any authenticated user
drop policy if exists "audits_select_own" on public.audits;
create policy "audits_select_own" on public.audits
  for select using (auth.role() = 'authenticated');
drop policy if exists "audits_insert_own" on public.audits;
create policy "audits_insert_own" on public.audits
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "audits_update_own" on public.audits;
create policy "audits_update_own" on public.audits
  for update using (auth.role() = 'authenticated');
drop policy if exists "audits_delete_own" on public.audits;
create policy "audits_delete_own" on public.audits
  for delete using (auth.role() = 'authenticated');

-- Reusable pattern for every audit-scoped child table: any authenticated
-- user. The audit_id FK (references public.audits ... on delete cascade)
-- still enforces that every row belongs to a real audit — RLS no longer
-- needs to re-check that via an EXISTS lookup.
drop policy if exists "audit_files_all_own_audit" on public.audit_files;
create policy "audit_files_all_own_audit" on public.audit_files
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "business_report_data_all_own_audit" on public.business_report_data;
create policy "business_report_data_all_own_audit" on public.business_report_data
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "sp_campaign_data_all_own_audit" on public.sp_campaign_data;
create policy "sp_campaign_data_all_own_audit" on public.sp_campaign_data
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "sb_campaign_data_all_own_audit" on public.sb_campaign_data;
create policy "sb_campaign_data_all_own_audit" on public.sb_campaign_data
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "sd_campaign_data_all_own_audit" on public.sd_campaign_data;
create policy "sd_campaign_data_all_own_audit" on public.sd_campaign_data
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "sp_search_term_data_all_own_audit" on public.sp_search_term_data;
create policy "sp_search_term_data_all_own_audit" on public.sp_search_term_data
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "sb_search_term_data_all_own_audit" on public.sb_search_term_data;
create policy "sb_search_term_data_all_own_audit" on public.sb_search_term_data
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "brand_keywords_all_own_audit" on public.brand_keywords;
create policy "brand_keywords_all_own_audit" on public.brand_keywords
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "audit_notes_all_own_audit" on public.audit_notes;
create policy "audit_notes_all_own_audit" on public.audit_notes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================================
-- Storage — 'audit-files' bucket — any authenticated user.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('audit-files', 'audit-files', false)
on conflict (id) do nothing;

-- Superseded by the role-based policies at the bottom of this file
-- (audit_files_storage_*_role) — dropped here in case this section runs
-- before that one on a partially-migrated database.
drop policy if exists "audit_files_storage_select_own" on storage.objects;
drop policy if exists "audit_files_storage_insert_own" on storage.objects;
drop policy if exists "audit_files_storage_update_own" on storage.objects;
drop policy if exists "audit_files_storage_delete_own" on storage.objects;

-- ============================================================================
-- Role-based access control (RBAC) — three roles: admin, team, client.
--
-- admin  — full access to everything, plus user/role management and delete.
-- team   — same data access as admin (view/create/upload/edit notes on every
--          brand and audit) but cannot delete brands/audits and cannot
--          manage users.
-- client — read-only, and only for brands explicitly granted via
--          client_brand_access. No create, no upload, no notes editing, no
--          delete, anywhere.
--
-- A user with no row in user_roles at all (new signup, not yet assigned) is
-- treated as having no access to anything — every policy below is written as
-- an explicit allow-list, so the safe default is "nothing" until an admin
-- assigns a role on /dashboard/team.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_roles
-- ----------------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('admin', 'team', 'client')),
  created_at timestamptz default now(),
  unique(user_id)
);

alter table public.user_roles enable row level security;

drop policy if exists "Authenticated users can read roles" on public.user_roles;
create policy "Authenticated users can read roles" on public.user_roles
  for select using (auth.role() = 'authenticated');

-- Self-referencing on purpose: this subquery's own SELECT is permitted by
-- the read policy above (unconditional for any authenticated user), so it
-- resolves without recursion.
drop policy if exists "Admins can manage roles" on public.user_roles;
create policy "Admins can manage roles" on public.user_roles for all using (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
);

-- ----------------------------------------------------------------------------
-- client_brand_access — which brands a client-role user can see.
-- ----------------------------------------------------------------------------
create table if not exists public.client_brand_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  brand_id uuid references public.brands(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, brand_id)
);

alter table public.client_brand_access enable row level security;

drop policy if exists "Authenticated users can read access" on public.client_brand_access;
create policy "Authenticated users can read access" on public.client_brand_access
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins can manage access" on public.client_brand_access;
create policy "Admins can manage access" on public.client_brand_access for all using (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
);

-- ----------------------------------------------------------------------------
-- First-user-admin bootstrap.
--
-- "Admins can manage roles" above requires an existing admin to already
-- exist, so there is no way to grant the very first admin through normal
-- RLS-protected app queries — it has to happen here, bypassing RLS.
--
-- One-time backfill: if user_roles is empty but at least one account already
-- exists (e.g. re-running this file against a database that predates RBAC),
-- promote the oldest account to admin.
-- ----------------------------------------------------------------------------
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users
where not exists (select 1 from public.user_roles)
order by created_at asc
limit 1;

-- Going forward: the first person to ever sign up after this migration runs
-- is made admin automatically; everyone after that gets no role until an
-- admin assigns one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Role-check helpers, reused by every policy below.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_admin_or_team()
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'team'));
$$;

-- True for admin/team (who see every brand) or a client explicitly granted
-- access to this one via client_brand_access.
create or replace function public.can_view_brand(p_brand_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_admin_or_team()
    or exists (
      select 1 from public.client_brand_access
      where user_id = auth.uid() and brand_id = p_brand_id
    );
$$;

create or replace function public.can_view_audit(p_audit_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.audits a
    where a.id = p_audit_id and public.can_view_brand(a.brand_id)
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_or_team() to authenticated;
grant execute on function public.can_view_brand(uuid) to authenticated;
grant execute on function public.can_view_audit(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- fn_list_users — powers the Team page's user list. auth.users isn't
-- reachable through PostgREST directly, so this SECURITY DEFINER function
-- (runs with its owner's privileges, not the caller's) reads it on the
-- caller's behalf — gated by an explicit is_admin() check inside the
-- function body, since SECURITY DEFINER bypasses RLS entirely and this
-- would otherwise leak every user's email to any authenticated caller.
-- ----------------------------------------------------------------------------
create or replace function public.fn_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can list users';
  end if;
  return query
    select u.id, u.email::text, u.created_at, ur.role
    from auth.users u
    left join public.user_roles ur on ur.user_id = u.id
    order by u.created_at asc;
end;
$$;

grant execute on function public.fn_list_users() to authenticated;

-- ----------------------------------------------------------------------------
-- brands — view: admin/team see all, client sees only granted brands.
--          create/update: admin/team. delete: admin only.
-- ----------------------------------------------------------------------------
drop policy if exists "brands_select_own" on public.brands;
drop policy if exists "brands_select_role" on public.brands;
create policy "brands_select_role" on public.brands
  for select using (public.can_view_brand(id));

drop policy if exists "brands_insert_own" on public.brands;
drop policy if exists "brands_insert_role" on public.brands;
create policy "brands_insert_role" on public.brands
  for insert with check (public.is_admin_or_team());

drop policy if exists "brands_update_own" on public.brands;
drop policy if exists "brands_update_role" on public.brands;
create policy "brands_update_role" on public.brands
  for update using (public.is_admin_or_team());

drop policy if exists "brands_delete_own" on public.brands;
drop policy if exists "brands_delete_role" on public.brands;
create policy "brands_delete_role" on public.brands
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- audits — same visibility/modify shape as brands, keyed off the parent brand.
-- ----------------------------------------------------------------------------
drop policy if exists "audits_select_own" on public.audits;
drop policy if exists "audits_select_role" on public.audits;
create policy "audits_select_role" on public.audits
  for select using (public.can_view_brand(brand_id));

drop policy if exists "audits_insert_own" on public.audits;
drop policy if exists "audits_insert_role" on public.audits;
create policy "audits_insert_role" on public.audits
  for insert with check (public.is_admin_or_team());

drop policy if exists "audits_update_own" on public.audits;
drop policy if exists "audits_update_role" on public.audits;
create policy "audits_update_role" on public.audits
  for update using (public.is_admin_or_team());

drop policy if exists "audits_delete_own" on public.audits;
drop policy if exists "audits_delete_role" on public.audits;
create policy "audits_delete_role" on public.audits
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Every audit-scoped child table (uploads, parsed data, notes): two policies
-- each — SELECT follows can_view_audit(), every write (insert/update/delete)
-- is admin/team only. The "for all" write policy also technically covers
-- SELECT, but that just OR's in harmlessly alongside the dedicated SELECT
-- policy (permissive policies combine with OR) since is_admin_or_team()
-- already implies can_view_audit() is true.
--
-- There's no standalone "delete a single file/row" feature in the app —
-- deletion only happens via cascade when an admin deletes the parent
-- audit/brand (gated by admin-only DELETE policies above) — so
-- is_admin_or_team() here (not is_admin()) is deliberately looser than the
-- parent tables' delete policy without weakening anything in practice.
-- ----------------------------------------------------------------------------
drop policy if exists "audit_files_all_own_audit" on public.audit_files;
drop policy if exists "audit_files_select_role" on public.audit_files;
create policy "audit_files_select_role" on public.audit_files
  for select using (public.can_view_audit(audit_id));
drop policy if exists "audit_files_write_role" on public.audit_files;
create policy "audit_files_write_role" on public.audit_files
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

drop policy if exists "business_report_data_all_own_audit" on public.business_report_data;
drop policy if exists "business_report_data_select_role" on public.business_report_data;
create policy "business_report_data_select_role" on public.business_report_data
  for select using (public.can_view_audit(audit_id));
drop policy if exists "business_report_data_write_role" on public.business_report_data;
create policy "business_report_data_write_role" on public.business_report_data
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

drop policy if exists "sp_campaign_data_all_own_audit" on public.sp_campaign_data;
drop policy if exists "sp_campaign_data_select_role" on public.sp_campaign_data;
create policy "sp_campaign_data_select_role" on public.sp_campaign_data
  for select using (public.can_view_audit(audit_id));
drop policy if exists "sp_campaign_data_write_role" on public.sp_campaign_data;
create policy "sp_campaign_data_write_role" on public.sp_campaign_data
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

drop policy if exists "sb_campaign_data_all_own_audit" on public.sb_campaign_data;
drop policy if exists "sb_campaign_data_select_role" on public.sb_campaign_data;
create policy "sb_campaign_data_select_role" on public.sb_campaign_data
  for select using (public.can_view_audit(audit_id));
drop policy if exists "sb_campaign_data_write_role" on public.sb_campaign_data;
create policy "sb_campaign_data_write_role" on public.sb_campaign_data
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

drop policy if exists "sd_campaign_data_all_own_audit" on public.sd_campaign_data;
drop policy if exists "sd_campaign_data_select_role" on public.sd_campaign_data;
create policy "sd_campaign_data_select_role" on public.sd_campaign_data
  for select using (public.can_view_audit(audit_id));
drop policy if exists "sd_campaign_data_write_role" on public.sd_campaign_data;
create policy "sd_campaign_data_write_role" on public.sd_campaign_data
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

drop policy if exists "sp_search_term_data_all_own_audit" on public.sp_search_term_data;
drop policy if exists "sp_search_term_data_select_role" on public.sp_search_term_data;
create policy "sp_search_term_data_select_role" on public.sp_search_term_data
  for select using (public.can_view_audit(audit_id));
drop policy if exists "sp_search_term_data_write_role" on public.sp_search_term_data;
create policy "sp_search_term_data_write_role" on public.sp_search_term_data
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

drop policy if exists "sb_search_term_data_all_own_audit" on public.sb_search_term_data;
drop policy if exists "sb_search_term_data_select_role" on public.sb_search_term_data;
create policy "sb_search_term_data_select_role" on public.sb_search_term_data
  for select using (public.can_view_audit(audit_id));
drop policy if exists "sb_search_term_data_write_role" on public.sb_search_term_data;
create policy "sb_search_term_data_write_role" on public.sb_search_term_data
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

drop policy if exists "brand_keywords_all_own_audit" on public.brand_keywords;
drop policy if exists "brand_keywords_select_role" on public.brand_keywords;
create policy "brand_keywords_select_role" on public.brand_keywords
  for select using (public.can_view_audit(audit_id));
drop policy if exists "brand_keywords_write_role" on public.brand_keywords;
create policy "brand_keywords_write_role" on public.brand_keywords
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

-- audit_notes: same shape — a client can read notes (SectionCard renders
-- them read-only) but never write one.
drop policy if exists "audit_notes_all_own_audit" on public.audit_notes;
drop policy if exists "audit_notes_select_role" on public.audit_notes;
create policy "audit_notes_select_role" on public.audit_notes
  for select using (public.can_view_audit(audit_id));
drop policy if exists "audit_notes_write_role" on public.audit_notes;
create policy "audit_notes_write_role" on public.audit_notes
  for all using (public.is_admin_or_team()) with check (public.is_admin_or_team());

-- ----------------------------------------------------------------------------
-- Storage — 'audit-files' bucket, same select/write split as the child
-- tables above. storage.objects has no audit_id column, so the path's first
-- segment (`${audit_id}/${file_type}/${filename}`) is parsed instead.
-- ----------------------------------------------------------------------------
drop policy if exists "audit_files_storage_select_role" on storage.objects;
create policy "audit_files_storage_select_role"
  on storage.objects for select
  using (
    bucket_id = 'audit-files'
    and exists (
      select 1 from public.audits a
      where a.id::text = (storage.foldername(name))[1]
      and public.can_view_brand(a.brand_id)
    )
  );

drop policy if exists "audit_files_storage_insert_role" on storage.objects;
create policy "audit_files_storage_insert_role"
  on storage.objects for insert
  with check (bucket_id = 'audit-files' and public.is_admin_or_team());

drop policy if exists "audit_files_storage_update_role" on storage.objects;
create policy "audit_files_storage_update_role"
  on storage.objects for update
  using (bucket_id = 'audit-files' and public.is_admin_or_team());

drop policy if exists "audit_files_storage_delete_role" on storage.objects;
create policy "audit_files_storage_delete_role"
  on storage.objects for delete
  using (bucket_id = 'audit-files' and public.is_admin_or_team());
