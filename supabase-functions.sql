-- ============================================================================
-- Audit dashboard aggregation functions
--
-- The dashboard used to download every raw row (business report, campaign,
-- and search-term data — 270,000+ rows on a large audit) to the browser and
-- compute every KPI/table client-side. These functions move that aggregation
-- into Postgres: each one filters + groups + sums inside the database and
-- returns only the final rows the UI actually renders (tens of rows, not
-- hundreds of thousands).
--
-- Paste this whole file into the Supabase SQL editor and run it once. It's
-- safe to re-run (every object uses CREATE OR REPLACE / IF NOT EXISTS).
--
-- SECURITY: every function below runs with the caller's own privileges
-- (Postgres default — this file never uses SECURITY DEFINER), so the exact
-- same Row Level Security policies from supabase-schema.sql still apply.
-- A user who doesn't own the audit gets empty results, exactly like today.
--
-- NOTE on two function signatures vs. the original spec: fn_wasted_spend and
-- fn_bleeders were requested with a single threshold parameter, but the
-- dashboard actually needs a MIN and MAX click/spend band (e.g. "1 to 5
-- clicks" and "6+ clicks"). Both functions below take an added p_max_clicks /
-- p_max_spend parameter (nullable — null means "and above") so they can
-- reproduce the app's existing bands; everything else matches the requested
-- names/behavior.
-- ============================================================================


-- ============================================================================
-- Indexes
--
-- All 6 originally-requested indexes already exist in supabase-schema.sql
-- under different names — creating them again with new names would just be
-- duplicate indexes (extra write overhead on every insert, no query benefit):
--   idx_sp_campaign_audit_entity  -> sp_campaign_data_entity_idx (audit_id, entity)
--   idx_sb_campaign_audit_entity  -> sb_campaign_data_entity_idx (audit_id, entity)
--   idx_sd_campaign_audit_entity  -> sd_campaign_data_entity_idx (audit_id, entity)
--   idx_sp_search_audit           -> sp_search_term_data_audit_id_idx (audit_id)
--   idx_sb_search_audit           -> sb_search_term_data_audit_id_idx (audit_id)
--   idx_business_report_audit     -> business_report_data_audit_id_idx (audit_id)
--
-- The indexes below are genuinely new — they target query shapes the raw
-- schema didn't need but these RPCs do: filtering search terms by
-- search_term_type (fn_bleeders' keyword/ASIN toggle) and the zero-order,
-- sort-by-spend pattern shared by fn_wasted_spend and fn_bleeders.
-- ============================================================================
create index if not exists sp_search_term_data_term_type_idx
  on public.sp_search_term_data (audit_id, search_term_type);
create index if not exists sb_search_term_data_term_type_idx
  on public.sb_search_term_data (audit_id, search_term_type);

create index if not exists sp_search_term_data_zero_order_spend_idx
  on public.sp_search_term_data (audit_id, spend desc)
  where coalesce(orders, 0) = 0;
create index if not exists sb_search_term_data_zero_order_spend_idx
  on public.sb_search_term_data (audit_id, spend desc)
  where coalesce(orders, 0) = 0;


-- ============================================================================
-- Shared helper — derives cpc/acos/roas/cvr/pct_of_spend/pct_of_sales exactly
-- the way src/lib/calculations/aggregate.ts's deriveMetrics() does client-side
-- today, so every function below stays consistent with one formula each.
-- cvr here is always PPC CVR% = orders ÷ clicks × 100 (never a business
-- report session-based conversion rate) — every function that calls this
-- helper (ad_type_split, auto_manual_split, match_type_analysis, placements,
-- bidding_strategy, branded_split, advertised_asin_performance) already gets
-- the correct PPC formula for free.
-- ============================================================================
create or replace function public.fn_derive_metrics(
  p_clicks bigint,
  p_orders bigint,
  p_spend numeric,
  p_sales numeric,
  p_total_spend numeric,
  p_total_sales numeric
)
returns table (
  cpc numeric,
  acos numeric,
  roas numeric,
  cvr numeric,
  pct_of_spend numeric,
  pct_of_sales numeric
)
language sql
immutable
as $$
  select
    case when coalesce(p_clicks, 0) > 0 then p_spend / p_clicks else null end,
    case when coalesce(p_sales, 0) > 0 then (p_spend / p_sales) * 100 else null end,
    case when coalesce(p_spend, 0) > 0 then p_sales / p_spend else null end,
    (p_orders::numeric / nullif(coalesce(p_clicks, 0), 0)) * 100,
    case when coalesce(p_total_spend, 0) > 0 then (p_spend / p_total_spend) * 100 else 0 end,
    case when coalesce(p_total_sales, 0) > 0 then (p_sales / p_total_sales) * 100 else 0 end;
$$;


-- ============================================================================
-- 1. fn_summary_kpis — Overall Performance KPI row (Summary tab)
-- Mirrors computeOverallKpis() in src/lib/calculations/summary.ts
--
-- avg_cvr is PPC CVR%: total PPC orders ÷ total PPC clicks across SP+SB+SD
-- campaign data (entity = Campaign) — a weighted ratio-of-sums, same
-- methodology as every other CVR% in the app, NOT an average of the
-- business report's session-based unit_session_percentage. Returned already
-- multiplied by 100 (e.g. 12.5, meaning "12.5%") — the UI just appends "%",
-- it does not divide, so this must never be returned as a 0-1 fraction.
-- ============================================================================
create or replace function public.fn_summary_kpis(p_audit_id uuid)
returns table (
  total_revenue numeric,
  total_spend numeric,
  tacos numeric,
  avg_cvr numeric,
  total_units bigint
)
language sql
stable
as $$
  with br as (
    select
      coalesce(sum(ordered_product_sales), 0)::numeric as total_revenue,
      coalesce(sum(units_ordered), 0)::bigint as total_units
    from public.business_report_data
    where audit_id = p_audit_id
  ),
  campaigns as (
    select spend, clicks, orders
    from public.sp_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'campaign'
    union all
    select spend, clicks, orders
    from public.sb_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'campaign'
    union all
    select spend, clicks, orders
    from public.sd_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'campaign'
  ),
  ppc as (
    select
      coalesce(sum(spend), 0)::numeric as total_spend,
      coalesce(sum(clicks), 0)::numeric as total_clicks,
      coalesce(sum(orders), 0)::numeric as total_orders
    from campaigns
  )
  select
    br.total_revenue,
    ppc.total_spend,
    case when br.total_revenue > 0 then (ppc.total_spend / br.total_revenue) * 100 else null end,
    (ppc.total_orders / nullif(ppc.total_clicks, 0)) * 100,
    br.total_units
  from br, ppc;
$$;


-- ============================================================================
-- 2. fn_top_asins — Top 10 ASINs by Units Ordered (Summary tab)
-- Mirrors computeTopAsins()
-- ============================================================================
-- cvr is PPC CVR%: this ASIN's SP orders ÷ SP clicks (entity = Product Ad),
-- NOT the business report's session-based unit_session_percentage. Returned
-- already multiplied by 100 (e.g. 12.5, meaning "12.5%") — the UI just
-- appends "%", it does not divide.
create or replace function public.fn_top_asins(p_audit_id uuid, p_limit int default 10)
returns table (
  asin text,
  title text,
  units_ordered bigint,
  revenue numeric,
  aov numeric,
  cvr numeric,
  sessions bigint,
  page_views_per_session numeric,
  sp_spend numeric,
  sp_tacos numeric,
  pct_of_sp_spend numeric,
  pct_of_unit_sales numeric
)
language sql
stable
as $$
  with sp_by_asin as (
    select asin,
           coalesce(sum(spend), 0) as spend,
           coalesce(sum(clicks), 0) as clicks,
           coalesce(sum(orders), 0) as orders
    from public.sp_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'product ad' and asin is not null
    group by asin
  ),
  totals as (
    select
      coalesce((select sum(spend) from sp_by_asin), 0) as total_sp_spend,
      coalesce((select sum(units_ordered) from public.business_report_data where audit_id = p_audit_id), 0) as total_units
  )
  select
    br.child_asin,
    br.title,
    coalesce(br.units_ordered, 0)::bigint,
    coalesce(br.ordered_product_sales, 0)::numeric,
    case when coalesce(br.units_ordered, 0) > 0
      then coalesce(br.ordered_product_sales, 0) / br.units_ordered
      else null end,
    (coalesce(sba.orders, 0)::numeric / nullif(coalesce(sba.clicks, 0), 0)) * 100,
    coalesce(br.sessions_total, 0)::bigint,
    case when coalesce(br.sessions_total, 0) > 0
      then coalesce(br.page_views_total, 0)::numeric / br.sessions_total
      else null end,
    coalesce(sba.spend, 0)::numeric,
    case when coalesce(br.ordered_product_sales, 0) > 0
      then (coalesce(sba.spend, 0) / br.ordered_product_sales) * 100
      else null end,
    case when t.total_sp_spend > 0 then (coalesce(sba.spend, 0) / t.total_sp_spend) * 100 else 0 end,
    case when t.total_units > 0 then (coalesce(br.units_ordered, 0)::numeric / t.total_units) * 100 else 0 end
  from public.business_report_data br
  cross join totals t
  left join sp_by_asin sba on sba.asin = br.child_asin
  where br.audit_id = p_audit_id and br.child_asin is not null
  order by coalesce(br.units_ordered, 0) desc
  limit p_limit;
$$;


-- ============================================================================
-- 3. fn_advertised_asin_performance — SP Product Ad performance grouped by ASIN
-- Mirrors computeAdvertisedAsinPerformance()
-- ============================================================================
create or replace function public.fn_advertised_asin_performance(p_audit_id uuid)
returns table (
  asin text,
  impressions bigint,
  clicks bigint,
  orders bigint,
  units bigint,
  spend numeric,
  sales numeric,
  cpc numeric,
  acos numeric,
  roas numeric,
  cvr numeric,
  pct_of_spend numeric,
  pct_of_sales numeric
)
language sql
stable
as $$
  with filtered as (
    select asin, impressions, clicks, orders, units, spend, sales
    from public.sp_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'product ad' and asin is not null
  ),
  by_asin as (
    select
      asin,
      coalesce(sum(impressions), 0)::bigint as impressions,
      coalesce(sum(clicks), 0)::bigint as clicks,
      coalesce(sum(orders), 0)::bigint as orders,
      coalesce(sum(units), 0)::bigint as units,
      coalesce(sum(spend), 0)::numeric as spend,
      coalesce(sum(sales), 0)::numeric as sales
    from filtered
    group by asin
  ),
  totals as (
    select coalesce(sum(spend), 0)::numeric as spend, coalesce(sum(sales), 0)::numeric as sales
    from filtered
  )
  select b.asin, b.impressions, b.clicks, b.orders, b.units, b.spend, b.sales,
         d.cpc, d.acos, d.roas, d.cvr, d.pct_of_spend, d.pct_of_sales
  from by_asin b
  cross join totals t
  cross join lateral public.fn_derive_metrics(b.clicks, b.orders, b.spend, b.sales, t.spend, t.sales) d
  order by b.spend desc;
$$;


-- ============================================================================
-- 4. fn_ad_type_split — SP/SB/SD spend split + Grand Total (Ad Analysis tab)
-- Mirrors computeAdTypeSpendSplit()
-- ============================================================================
create or replace function public.fn_ad_type_split(p_audit_id uuid)
returns table (
  label text, impressions bigint, clicks bigint, orders bigint, units bigint,
  spend numeric, sales numeric, cpc numeric, acos numeric, roas numeric, cvr numeric,
  pct_of_spend numeric, pct_of_sales numeric
)
language sql
stable
as $$
  with by_type as (
    select 'SP' as label,
           coalesce(sum(impressions), 0)::bigint as impressions, coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders, coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend, coalesce(sum(sales), 0)::numeric as sales
    from public.sp_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'campaign'
    union all
    select 'SB',
           coalesce(sum(impressions), 0)::bigint, coalesce(sum(clicks), 0)::bigint,
           coalesce(sum(orders), 0)::bigint, coalesce(sum(units), 0)::bigint,
           coalesce(sum(spend), 0)::numeric, coalesce(sum(sales), 0)::numeric
    from public.sb_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'campaign'
    union all
    select 'SD',
           coalesce(sum(impressions), 0)::bigint, coalesce(sum(clicks), 0)::bigint,
           coalesce(sum(orders), 0)::bigint, coalesce(sum(units), 0)::bigint,
           coalesce(sum(spend), 0)::numeric, coalesce(sum(sales), 0)::numeric
    from public.sd_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'campaign'
  ),
  grand as (
    select 'Grand Total' as label,
           coalesce(sum(impressions), 0)::bigint as impressions, coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders, coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend, coalesce(sum(sales), 0)::numeric as sales
    from by_type
  ),
  combined as (select * from by_type union all select * from grand)
  select c.label, c.impressions, c.clicks, c.orders, c.units, c.spend, c.sales,
         d.cpc, d.acos, d.roas, d.cvr, d.pct_of_spend, d.pct_of_sales
  from combined c
  cross join grand g
  cross join lateral public.fn_derive_metrics(c.clicks, c.orders, c.spend, c.sales, g.spend, g.sales) d;
$$;


-- ============================================================================
-- 5. fn_auto_manual_split — Auto vs Manual + Grand Total, SP only
-- Mirrors computeAutoVsManual()
-- ============================================================================
create or replace function public.fn_auto_manual_split(p_audit_id uuid)
returns table (
  label text, impressions bigint, clicks bigint, orders bigint, units bigint,
  spend numeric, sales numeric, cpc numeric, acos numeric, roas numeric, cvr numeric,
  pct_of_spend numeric, pct_of_sales numeric
)
language sql
stable
as $$
  with campaigns as (
    select * from public.sp_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'campaign'
  ),
  by_type as (
    select 'Auto' as label,
           coalesce(sum(impressions), 0)::bigint as impressions, coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders, coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend, coalesce(sum(sales), 0)::numeric as sales
    from campaigns where trim(lower(targeting_type)) = 'auto'
    union all
    select 'Manual',
           coalesce(sum(impressions), 0)::bigint, coalesce(sum(clicks), 0)::bigint,
           coalesce(sum(orders), 0)::bigint, coalesce(sum(units), 0)::bigint,
           coalesce(sum(spend), 0)::numeric, coalesce(sum(sales), 0)::numeric
    from campaigns where trim(lower(targeting_type)) = 'manual'
  ),
  grand as (
    select 'Grand Total' as label,
           coalesce(sum(impressions), 0)::bigint as impressions, coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders, coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend, coalesce(sum(sales), 0)::numeric as sales
    from campaigns
  ),
  combined as (select * from by_type union all select * from grand)
  select c.label, c.impressions, c.clicks, c.orders, c.units, c.spend, c.sales,
         d.cpc, d.acos, d.roas, d.cvr, d.pct_of_spend, d.pct_of_sales
  from combined c
  cross join grand g
  cross join lateral public.fn_derive_metrics(c.clicks, c.orders, c.spend, c.sales, g.spend, g.sales) d;
$$;


-- ============================================================================
-- 6. fn_match_type_analysis — SP (11 types) or SB (6 types) + Grand Total
-- Mirrors computeMatchTypeAnalysis(). p_ad_type is 'sp' or 'sb'.
--
-- Rewritten from language plpgsql to plain language sql (matching every
-- other function in this file) — it was the only plpgsql function here,
-- using a declared array + IF/ELSE to pick the match-type list. That
-- structural difference was removed as a possible variable while
-- investigating a 404 reported for p_ad_type = 'sp' calls; the category
-- list is now a conditional VALUES CTE instead of a plpgsql variable.
-- ============================================================================
create or replace function public.fn_match_type_analysis(p_audit_id uuid, p_ad_type text)
returns table (
  label text, impressions bigint, clicks bigint, orders bigint, units bigint,
  spend numeric, sales numeric, cpc numeric, acos numeric, roas numeric, cvr numeric,
  pct_of_spend numeric, pct_of_sales numeric
)
language sql
stable
as $$
  with match_types(label, ord) as (
    select * from (values
      ('ASIN-Exact', 1), ('ASIN-Expanded', 2), ('Broad', 3), ('Exact', 4), ('Phrase', 5), ('Category', 6),
      ('Keyword Group', 7), ('Auto Close-match', 8), ('Auto Loose-match', 9),
      ('Auto Substitutes', 10), ('Auto Complements', 11)
    ) as sp(label, ord)
    where lower(p_ad_type) = 'sp'
    union all
    select * from (values
      ('Broad', 1), ('Phrase', 2), ('Exact', 3), ('ASIN-Exact', 4), ('ASIN-Expanded', 5), ('Category', 6)
    ) as sb(label, ord)
    where lower(p_ad_type) = 'sb'
  ),
  filtered as (
    select final_match_type, impressions, clicks, orders, units, spend, sales
    from public.sp_campaign_data
    where audit_id = p_audit_id and lower(p_ad_type) = 'sp'
      and trim(lower(entity)) in ('keyword', 'product targeting')
    union all
    select final_match_type, impressions, clicks, orders, units, spend, sales
    from public.sb_campaign_data
    where audit_id = p_audit_id and lower(p_ad_type) = 'sb'
      and trim(lower(entity)) in ('keyword', 'product targeting')
  ),
  by_type as (
    select mt.label, mt.ord,
           coalesce(sum(f.impressions), 0)::bigint as impressions,
           coalesce(sum(f.clicks), 0)::bigint as clicks,
           coalesce(sum(f.orders), 0)::bigint as orders,
           coalesce(sum(f.units), 0)::bigint as units,
           coalesce(sum(f.spend), 0)::numeric as spend,
           coalesce(sum(f.sales), 0)::numeric as sales
    from match_types mt
    left join filtered f on f.final_match_type = mt.label
    group by mt.label, mt.ord
  ),
  grand as (
    select 'Grand Total' as label, 999 as ord,
           coalesce(sum(impressions), 0)::bigint as impressions,
           coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders,
           coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend,
           coalesce(sum(sales), 0)::numeric as sales
    from filtered
  ),
  combined as (select * from by_type union all select * from grand)
  select c.label, c.impressions, c.clicks, c.orders, c.units, c.spend, c.sales,
         d.cpc, d.acos, d.roas, d.cvr, d.pct_of_spend, d.pct_of_sales
  from combined c
  cross join grand g
  cross join lateral public.fn_derive_metrics(c.clicks, c.orders, c.spend, c.sales, g.spend, g.sales) d
  order by c.ord;
$$;


-- ============================================================================
-- 7. fn_placements — SP Bidding Adjustment rows grouped by placement + Grand Total
-- Mirrors computePlacements()
-- ============================================================================
create or replace function public.fn_placements(p_audit_id uuid)
returns table (
  label text, impressions bigint, clicks bigint, orders bigint, units bigint,
  spend numeric, sales numeric, cpc numeric, acos numeric, roas numeric, cvr numeric,
  pct_of_spend numeric, pct_of_sales numeric
)
language sql
stable
as $$
  with categories(label, ord) as (
    values ('Top of Search',1), ('Rest of Search',2), ('Product Pages',3),
           ('Amazon Business',4), ('Audience',5)
  ),
  filtered as (
    select placement, impressions, clicks, orders, units, spend, sales
    from public.sp_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'bidding adjustment'
  ),
  by_cat as (
    select c.label, c.ord,
           coalesce(sum(f.impressions), 0)::bigint as impressions,
           coalesce(sum(f.clicks), 0)::bigint as clicks,
           coalesce(sum(f.orders), 0)::bigint as orders,
           coalesce(sum(f.units), 0)::bigint as units,
           coalesce(sum(f.spend), 0)::numeric as spend,
           coalesce(sum(f.sales), 0)::numeric as sales
    from categories c
    left join filtered f on f.placement = c.label
    group by c.label, c.ord
  ),
  grand as (
    select 'Grand Total' as label, 999 as ord,
           coalesce(sum(impressions), 0)::bigint as impressions,
           coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders,
           coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend,
           coalesce(sum(sales), 0)::numeric as sales
    from filtered
  ),
  combined as (select * from by_cat union all select * from grand)
  select c.label, c.impressions, c.clicks, c.orders, c.units, c.spend, c.sales,
         d.cpc, d.acos, d.roas, d.cvr, d.pct_of_spend, d.pct_of_sales
  from combined c
  cross join grand g
  cross join lateral public.fn_derive_metrics(c.clicks, c.orders, c.spend, c.sales, g.spend, g.sales) d
  order by c.ord;
$$;


-- ============================================================================
-- 8. fn_bidding_strategy — SP Bidding Adjustment rows grouped by bidding
--    strategy + Grand Total. Mirrors computeBiddingStrategySplit()
-- ============================================================================
create or replace function public.fn_bidding_strategy(p_audit_id uuid)
returns table (
  label text, impressions bigint, clicks bigint, orders bigint, units bigint,
  spend numeric, sales numeric, cpc numeric, acos numeric, roas numeric, cvr numeric,
  pct_of_spend numeric, pct_of_sales numeric
)
language sql
stable
as $$
  with categories(label, ord) as (
    values ('Fixed Bid',1), ('Up and Down',2), ('Down Only',3)
  ),
  filtered as (
    select bidding_strategy, impressions, clicks, orders, units, spend, sales
    from public.sp_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'bidding adjustment'
  ),
  by_cat as (
    select c.label, c.ord,
           coalesce(sum(f.impressions), 0)::bigint as impressions,
           coalesce(sum(f.clicks), 0)::bigint as clicks,
           coalesce(sum(f.orders), 0)::bigint as orders,
           coalesce(sum(f.units), 0)::bigint as units,
           coalesce(sum(f.spend), 0)::numeric as spend,
           coalesce(sum(f.sales), 0)::numeric as sales
    from categories c
    left join filtered f on f.bidding_strategy = c.label
    group by c.label, c.ord
  ),
  grand as (
    select 'Grand Total' as label, 999 as ord,
           coalesce(sum(impressions), 0)::bigint as impressions,
           coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders,
           coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend,
           coalesce(sum(sales), 0)::numeric as sales
    from filtered
  ),
  combined as (select * from by_cat union all select * from grand)
  select c.label, c.impressions, c.clicks, c.orders, c.units, c.spend, c.sales,
         d.cpc, d.acos, d.roas, d.cvr, d.pct_of_spend, d.pct_of_sales
  from combined c
  cross join grand g
  cross join lateral public.fn_derive_metrics(c.clicks, c.orders, c.spend, c.sales, g.spend, g.sales) d
  order by c.ord;
$$;


-- ============================================================================
-- 8b. fn_sd_cost_type — SD Campaign rows grouped by cost type (CPC / VCPM)
--     + Grand Total. Ad Analysis tab, "SD Cost Type Analysis" section.
-- ============================================================================
create or replace function public.fn_sd_cost_type(p_audit_id uuid)
returns table (
  label text, impressions bigint, clicks bigint, orders bigint, units bigint,
  spend numeric, sales numeric, cpc numeric, acos numeric, roas numeric, cvr numeric,
  pct_of_spend numeric, pct_of_sales numeric
)
language sql
stable
as $$
  with categories(label, ord) as (
    values ('CPC',1), ('VCPM',2)
  ),
  filtered as (
    select cost_type, impressions, clicks, orders, units, spend, sales
    from public.sd_campaign_data
    where audit_id = p_audit_id and trim(lower(entity)) = 'campaign'
  ),
  by_cat as (
    select c.label, c.ord,
           coalesce(sum(f.impressions), 0)::bigint as impressions,
           coalesce(sum(f.clicks), 0)::bigint as clicks,
           coalesce(sum(f.orders), 0)::bigint as orders,
           coalesce(sum(f.units), 0)::bigint as units,
           coalesce(sum(f.spend), 0)::numeric as spend,
           coalesce(sum(f.sales), 0)::numeric as sales
    from categories c
    left join filtered f on trim(upper(f.cost_type)) = c.label
    group by c.label, c.ord
  ),
  grand as (
    select 'Grand Total' as label, 999 as ord,
           coalesce(sum(impressions), 0)::bigint as impressions,
           coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders,
           coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend,
           coalesce(sum(sales), 0)::numeric as sales
    from filtered
  ),
  combined as (select * from by_cat union all select * from grand)
  select c.label, c.impressions, c.clicks, c.orders, c.units, c.spend, c.sales,
         d.cpc, d.acos, d.roas, d.cvr, d.pct_of_spend, d.pct_of_sales
  from combined c
  cross join grand g
  cross join lateral public.fn_derive_metrics(c.clicks, c.orders, c.spend, c.sales, g.spend, g.sales) d
  order by c.ord;
$$;


-- ============================================================================
-- 9. fn_branded_split — Branded vs Non-Branded + Grand Total (2 rows + total)
-- Mirrors computeBrandedVsNonBranded(). p_term_filter is 'both' | 'sp' | 'sb'.
-- "Branded" = customer_search_term contains any of the audit's brand_keywords
-- (case-insensitive substring match, same as isBrandedSearchTerm() in
-- src/lib/parsing/helpers.ts). search_term_count is included so the UI can
-- show "Show branded search terms (N)" without a second round trip.
-- ============================================================================
create or replace function public.fn_branded_split(p_audit_id uuid, p_term_filter text default 'both')
returns table (
  label text, impressions bigint, clicks bigint, orders bigint, units bigint,
  spend numeric, sales numeric, cpc numeric, acos numeric, roas numeric, cvr numeric,
  pct_of_spend numeric, pct_of_sales numeric, search_term_count bigint, has_brand_keywords boolean
)
language sql
stable
as $$
  with keywords as (
    select lower(trim(keyword)) as kw
    from public.brand_keywords
    where audit_id = p_audit_id and trim(keyword) <> ''
  ),
  keyword_presence as (
    select exists (select 1 from keywords) as has_brand_keywords
  ),
  source as (
    select customer_search_term, impressions, clicks, orders, units, spend, sales
    from public.sp_search_term_data
    where audit_id = p_audit_id and lower(p_term_filter) in ('sp', 'both')
    union all
    select customer_search_term, impressions, clicks, orders, units, spend, sales
    from public.sb_search_term_data
    where audit_id = p_audit_id and lower(p_term_filter) in ('sb', 'both')
  ),
  classified as (
    select s.*,
           exists (
             select 1 from keywords k
             where k.kw <> '' and strpos(lower(coalesce(s.customer_search_term, '')), k.kw) > 0
           ) as is_branded
    from source s
  ),
  categories(label, is_branded) as (
    values ('Branded', true), ('Non-Branded', false)
  ),
  by_type as (
    select cat.label,
           coalesce(sum(cl.impressions), 0)::bigint as impressions,
           coalesce(sum(cl.clicks), 0)::bigint as clicks,
           coalesce(sum(cl.orders), 0)::bigint as orders,
           coalesce(sum(cl.units), 0)::bigint as units,
           coalesce(sum(cl.spend), 0)::numeric as spend,
           coalesce(sum(cl.sales), 0)::numeric as sales,
           count(cl.is_branded)::bigint as search_term_count
    from categories cat
    left join classified cl on cl.is_branded = cat.is_branded
    group by cat.label
  ),
  grand as (
    select 'Grand Total' as label,
           coalesce(sum(impressions), 0)::bigint as impressions,
           coalesce(sum(clicks), 0)::bigint as clicks,
           coalesce(sum(orders), 0)::bigint as orders,
           coalesce(sum(units), 0)::bigint as units,
           coalesce(sum(spend), 0)::numeric as spend,
           coalesce(sum(sales), 0)::numeric as sales,
           count(*)::bigint as search_term_count
    from classified
  ),
  combined as (select * from by_type union all select * from grand)
  select c.label, c.impressions, c.clicks, c.orders, c.units, c.spend, c.sales,
         d.cpc, d.acos, d.roas, d.cvr, d.pct_of_spend, d.pct_of_sales, c.search_term_count,
         kp.has_brand_keywords
  from combined c
  cross join grand g
  cross join keyword_presence kp
  cross join lateral public.fn_derive_metrics(c.clicks, c.orders, c.spend, c.sales, g.spend, g.sales) d;
$$;


-- ============================================================================
-- 9b. fn_branded_search_terms — paginated drill-down of individual search
--     terms behind the "Show branded/non-branded search terms" toggle.
--     Not in the original list, but needed for the LIMIT 100 pagination
--     requirement — fn_branded_split above only returns the 2-row summary.
-- ============================================================================
create or replace function public.fn_branded_search_terms(
  p_audit_id uuid,
  p_term_filter text,
  p_branded boolean,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  customer_search_term text, spend numeric, orders int, clicks int, acos numeric, roas numeric
)
language sql
stable
as $$
  with keywords as (
    select lower(trim(keyword)) as kw
    from public.brand_keywords
    where audit_id = p_audit_id and trim(keyword) <> ''
  ),
  source as (
    select customer_search_term, spend, orders, clicks, acos, roas
    from public.sp_search_term_data
    where audit_id = p_audit_id and lower(p_term_filter) in ('sp', 'both')
    union all
    select customer_search_term, spend, orders, clicks, acos, roas
    from public.sb_search_term_data
    where audit_id = p_audit_id and lower(p_term_filter) in ('sb', 'both')
  ),
  classified as (
    select s.*,
           exists (
             select 1 from keywords k
             where k.kw <> '' and strpos(lower(coalesce(s.customer_search_term, '')), k.kw) > 0
           ) as is_branded
    from source s
  )
  select customer_search_term, coalesce(spend, 0)::numeric, coalesce(orders, 0)::int,
         coalesce(clicks, 0)::int, acos, roas
  from classified
  where is_branded = p_branded
  order by coalesce(spend, 0) desc
  limit p_limit offset p_offset;
$$;


-- ============================================================================
-- 10. fn_wasted_spend — zero-order search terms in a click band, grouped by
--     final match type + Grand Total. Mirrors computeWastedSpendTable().
--     p_ad_type is 'sp' or 'sb'. p_max_clicks null = "and above" (6+ band).
-- ============================================================================
create or replace function public.fn_wasted_spend(
  p_audit_id uuid,
  p_ad_type text,
  p_min_clicks int,
  p_max_clicks int default null
)
returns table (
  match_type text, spend numeric, orders int, search_term_count bigint,
  min_clicks int, max_clicks int, highest_cpc numeric
)
language sql
stable
as $$
  with filtered as (
    select coalesce(final_match_type, 'Unclassified') as match_type, spend, clicks, cpc
    from public.sp_search_term_data
    where audit_id = p_audit_id and lower(p_ad_type) = 'sp'
      and coalesce(orders, 0) = 0
      and coalesce(clicks, 0) >= p_min_clicks
      and (p_max_clicks is null or coalesce(clicks, 0) <= p_max_clicks)
    union all
    select coalesce(final_match_type, 'Unclassified') as match_type, spend, clicks, cpc
    from public.sb_search_term_data
    where audit_id = p_audit_id and lower(p_ad_type) = 'sb'
      and coalesce(orders, 0) = 0
      and coalesce(clicks, 0) >= p_min_clicks
      and (p_max_clicks is null or coalesce(clicks, 0) <= p_max_clicks)
  ),
  by_type as (
    select match_type,
           coalesce(sum(spend), 0)::numeric as spend,
           0 as orders,
           count(*)::bigint as search_term_count,
           coalesce(min(clicks), 0)::int as min_clicks,
           coalesce(max(clicks), 0)::int as max_clicks,
           coalesce(max(cpc), 0)::numeric as highest_cpc
    from filtered
    group by match_type
  ),
  grand as (
    select 'Grand Total' as match_type,
           coalesce(sum(spend), 0)::numeric as spend,
           0 as orders,
           count(*)::bigint as search_term_count,
           coalesce(min(clicks), 0)::int as min_clicks,
           coalesce(max(clicks), 0)::int as max_clicks,
           coalesce(max(cpc), 0)::numeric as highest_cpc
    from filtered
  )
  select * from (
    select * from by_type
    union all
    select * from grand
  ) as combined
  order by (combined.match_type = 'Grand Total'), combined.spend desc;
$$;


-- ============================================================================
-- 11. fn_bleeders — individual zero-order search terms in a spend band,
--     paginated (LIMIT/OFFSET), sorted by spend DESC. Mirrors
--     computeBleedersTable(). p_ad_type is 'sp' or 'sb'. p_max_spend null =
--     "and above" (the "Over $X" band). p_term_type is 'both' | 'keyword' |
--     'asin', matching search_term_type.
-- ============================================================================
create or replace function public.fn_bleeders(
  p_audit_id uuid,
  p_ad_type text,
  p_min_spend numeric,
  p_max_spend numeric default null,
  p_term_type text default 'both',
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  customer_search_term text, spend numeric, orders int, clicks int, avg_cpc numeric, highest_cpc numeric
)
language sql
stable
as $$
  with filtered as (
    select customer_search_term, spend, clicks, cpc, search_term_type
    from public.sp_search_term_data
    where audit_id = p_audit_id and lower(p_ad_type) = 'sp'
      and coalesce(orders, 0) = 0
      and coalesce(spend, 0) > p_min_spend
      and (p_max_spend is null or coalesce(spend, 0) <= p_max_spend)
      and (lower(p_term_type) = 'both' or search_term_type = lower(p_term_type))
    union all
    select customer_search_term, spend, clicks, cpc, search_term_type
    from public.sb_search_term_data
    where audit_id = p_audit_id and lower(p_ad_type) = 'sb'
      and coalesce(orders, 0) = 0
      and coalesce(spend, 0) > p_min_spend
      and (p_max_spend is null or coalesce(spend, 0) <= p_max_spend)
      and (lower(p_term_type) = 'both' or search_term_type = lower(p_term_type))
  )
  select
    coalesce(customer_search_term, '—'),
    coalesce(spend, 0)::numeric,
    0,
    coalesce(clicks, 0)::int,
    case when coalesce(clicks, 0) > 0 then spend / clicks else null end,
    coalesce(cpc, case when coalesce(clicks, 0) > 0 then spend / clicks else null end)
  from filtered
  order by coalesce(spend, 0) desc
  limit p_limit offset p_offset;
$$;


-- ============================================================================
-- Grants — Supabase's PostgREST API calls these as the `authenticated` role.
-- (CREATE FUNCTION grants EXECUTE to PUBLIC by default, but this makes it
-- explicit and safe to re-run.)
-- ============================================================================
grant execute on function public.fn_derive_metrics(bigint, bigint, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.fn_summary_kpis(uuid) to authenticated;
grant execute on function public.fn_top_asins(uuid, int) to authenticated;
grant execute on function public.fn_advertised_asin_performance(uuid) to authenticated;
grant execute on function public.fn_ad_type_split(uuid) to authenticated;
grant execute on function public.fn_auto_manual_split(uuid) to authenticated;
grant execute on function public.fn_match_type_analysis(uuid, text) to authenticated;
grant execute on function public.fn_placements(uuid) to authenticated;
grant execute on function public.fn_bidding_strategy(uuid) to authenticated;
grant execute on function public.fn_sd_cost_type(uuid) to authenticated;
grant execute on function public.fn_branded_split(uuid, text) to authenticated;
grant execute on function public.fn_branded_search_terms(uuid, text, boolean, int, int) to authenticated;
grant execute on function public.fn_wasted_spend(uuid, text, int, int) to authenticated;
grant execute on function public.fn_bleeders(uuid, text, numeric, numeric, text, int, int) to authenticated;
