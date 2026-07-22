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

drop policy if exists "audit_files_storage_select_own" on storage.objects;
create policy "audit_files_storage_select_own"
  on storage.objects for select
  using (bucket_id = 'audit-files' and auth.role() = 'authenticated');

drop policy if exists "audit_files_storage_insert_own" on storage.objects;
create policy "audit_files_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'audit-files' and auth.role() = 'authenticated');

drop policy if exists "audit_files_storage_update_own" on storage.objects;
create policy "audit_files_storage_update_own"
  on storage.objects for update
  using (bucket_id = 'audit-files' and auth.role() = 'authenticated');

drop policy if exists "audit_files_storage_delete_own" on storage.objects;
create policy "audit_files_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'audit-files' and auth.role() = 'authenticated');
