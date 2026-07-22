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
  created_at timestamptz not null default now()
);

-- Re-runnable against a database that already has this table from before
-- marketplace existed — CREATE TABLE IF NOT EXISTS above is a no-op there.
-- The DEFAULT backfills every pre-existing row to 'US' automatically.
alter table public.audits add column if not exists marketplace text not null default 'US';

create index if not exists audits_brand_id_idx on public.audits (brand_id);
create index if not exists audits_created_by_idx on public.audits (created_by);

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

-- brands: owner-only
create policy "brands_select_own" on public.brands
  for select using (created_by = auth.uid());
create policy "brands_insert_own" on public.brands
  for insert with check (created_by = auth.uid());
create policy "brands_update_own" on public.brands
  for update using (created_by = auth.uid());
create policy "brands_delete_own" on public.brands
  for delete using (created_by = auth.uid());

-- audits: owner-only
create policy "audits_select_own" on public.audits
  for select using (created_by = auth.uid());
create policy "audits_insert_own" on public.audits
  for insert with check (created_by = auth.uid());
create policy "audits_update_own" on public.audits
  for update using (created_by = auth.uid());
create policy "audits_delete_own" on public.audits
  for delete using (created_by = auth.uid());

-- Reusable pattern for every audit-scoped child table: the row is visible if
-- the parent audit belongs to the current user.
create policy "audit_files_all_own_audit" on public.audit_files
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

create policy "business_report_data_all_own_audit" on public.business_report_data
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

create policy "sp_campaign_data_all_own_audit" on public.sp_campaign_data
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

create policy "sb_campaign_data_all_own_audit" on public.sb_campaign_data
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

create policy "sd_campaign_data_all_own_audit" on public.sd_campaign_data
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

create policy "sp_search_term_data_all_own_audit" on public.sp_search_term_data
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

create policy "sb_search_term_data_all_own_audit" on public.sb_search_term_data
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

create policy "brand_keywords_all_own_audit" on public.brand_keywords
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

create policy "audit_notes_all_own_audit" on public.audit_notes
  for all using (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  ) with check (
    exists (select 1 from public.audits a where a.id = audit_id and a.created_by = auth.uid())
  );

-- ============================================================================
-- Storage — 'audit-files' bucket
-- Files are stored under `${audit_id}/${file_type}/${filename}`, so ownership
-- can be checked the same way as the data tables: the first path segment must
-- be an audit the current user owns.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('audit-files', 'audit-files', false)
on conflict (id) do nothing;

create policy "audit_files_storage_select_own"
  on storage.objects for select
  using (
    bucket_id = 'audit-files'
    and exists (
      select 1 from public.audits a
      where a.id::text = (storage.foldername(name))[1]
      and a.created_by = auth.uid()
    )
  );

create policy "audit_files_storage_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'audit-files'
    and exists (
      select 1 from public.audits a
      where a.id::text = (storage.foldername(name))[1]
      and a.created_by = auth.uid()
    )
  );

create policy "audit_files_storage_update_own"
  on storage.objects for update
  using (
    bucket_id = 'audit-files'
    and exists (
      select 1 from public.audits a
      where a.id::text = (storage.foldername(name))[1]
      and a.created_by = auth.uid()
    )
  );

create policy "audit_files_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'audit-files'
    and exists (
      select 1 from public.audits a
      where a.id::text = (storage.foldername(name))[1]
      and a.created_by = auth.uid()
    )
  );
