"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bulkInsert } from "@/lib/supabase/bulkInsert";
import { uploadFileWithProgress } from "@/lib/supabase/uploadWithProgress";
import { parseBusinessReport } from "@/lib/parsing/businessReport";
import {
  readBulkAdsWorkbook,
  parseSpCampaignsFromWorkbook,
  parseSbCampaignsFromWorkbook,
  parseSdCampaignsFromWorkbook,
  parseSpSearchTermsFromWorkbook,
  parseSbSearchTermsFromWorkbook,
} from "@/lib/parsing/bulkAds";
import { parseBrandKeywords } from "@/lib/parsing/brandKeywords";
import { fetchAuditData, fetchBrandName } from "@/lib/data/audit";
import { writeCache, clearCache } from "@/lib/cache/localCache";
import { cacheKeys } from "@/lib/cache/cacheKeys";
import { UploadZone } from "@/components/UploadZone";
import { ProgressSteps, type ProgressStepState } from "@/components/ProgressSteps";
import { MARKETPLACES } from "@/lib/marketplace";
import type { AuditFileType } from "@/types/database";

const UPLOAD_LABELS: Record<AuditFileType, string> = {
  business_report: "Business Report",
  bulk_ads: "Bulk Ads File",
  sqp: "SQP",
  brand_keywords: "Brand Keywords",
  top_keywords: "Top Keywords",
};

export default function NewAuditPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [marketplace, setMarketplace] = useState("US");
  const [businessReport, setBusinessReport] = useState<File | null>(null);
  const [bulkAds, setBulkAds] = useState<File | null>(null);
  const [sqp, setSqp] = useState<File | null>(null);
  const [brandKeywords, setBrandKeywords] = useState<File | null>(null);
  const [topKeywords, setTopKeywords] = useState<File | null>(null);

  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<ProgressStepState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim() && businessReport && bulkAds && !running;

  async function handleGenerate() {
    if (!businessReport || !bulkAds) return;
    setRunning(true);
    setError(null);
    const supabase = createClient();
    let auditId: string | null = null;

    const presentSlots: { type: AuditFileType; file: File }[] = [
      { type: "business_report", file: businessReport },
      { type: "bulk_ads", file: bulkAds },
      ...(sqp ? [{ type: "sqp" as const, file: sqp }] : []),
      ...(brandKeywords ? [{ type: "brand_keywords" as const, file: brandKeywords }] : []),
      ...(topKeywords ? [{ type: "top_keywords" as const, file: topKeywords }] : []),
    ];

    const initialSteps: ProgressStepState[] = [
      { key: "create-audit", label: "Creating audit", progress: 0, status: "pending" },
      ...presentSlots.map((slot) => ({
        key: `upload-${slot.type}`,
        label: `Uploading ${UPLOAD_LABELS[slot.type]}`,
        progress: 0,
        status: "pending" as const,
      })),
      { key: "parse-business-report", label: "Parsing Business Report", progress: 0, status: "pending" },
      { key: "parse-bulk-sp", label: "Parsing Bulk Ads (SP Campaigns)", progress: 0, status: "pending" },
      { key: "parse-bulk-sb", label: "Parsing Bulk Ads (SB Campaigns)", progress: 0, status: "pending" },
      { key: "parse-bulk-sd", label: "Parsing Bulk Ads (SD Campaigns)", progress: 0, status: "pending" },
      { key: "parse-bulk-sp-terms", label: "Parsing Bulk Ads (SP Search Terms)", progress: 0, status: "pending" },
      { key: "parse-bulk-sb-terms", label: "Parsing Bulk Ads (SB Search Terms)", progress: 0, status: "pending" },
      ...(brandKeywords
        ? [{ key: "parse-brand-keywords", label: "Parsing Brand Keywords", progress: 0, status: "pending" as const }]
        : []),
      { key: "save-data", label: "Saving parsed data", progress: 0, status: "pending" },
      { key: "finish", label: "Finishing up", progress: 0, status: "pending" },
      { key: "cache-data", label: "Caching for instant load", progress: 0, status: "pending" },
    ];
    setSteps(initialSteps);

    const updateStep = (key: string, patch: Partial<ProgressStepState>) =>
      setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

    try {
      updateStep("create-audit", { status: "active" });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired — please sign in again.");

      const { data: audit, error: auditError } = await supabase
        .from("audits")
        .insert({ brand_id: brandId, title: title.trim(), status: "processing", marketplace, created_by: user.id })
        .select()
        .single();
      if (auditError || !audit) throw new Error(auditError?.message ?? "Could not create audit.");
      auditId = audit.id;
      updateStep("create-audit", { status: "done", progress: 100 });

      for (const slot of presentSlots) {
        const stepKey = `upload-${slot.type}`;
        updateStep(stepKey, { status: "active", progress: 0 });
        const storagePath = `${auditId}/${slot.type}/${slot.file.name}`;
        await uploadFileWithProgress(supabase, "audit-files", storagePath, slot.file, (pct) =>
          updateStep(stepKey, { progress: pct })
        );

        const { error: fileRowError } = await supabase.from("audit_files").insert({
          audit_id: auditId,
          file_type: slot.type,
          file_name: slot.file.name,
          storage_path: storagePath,
        });
        if (fileRowError) throw new Error(fileRowError.message);
        updateStep(stepKey, { status: "done", progress: 100 });
      }

      updateStep("parse-business-report", { status: "active" });
      const businessReportRows = parseBusinessReport(await businessReport.arrayBuffer());
      updateStep("parse-business-report", { status: "done", progress: 100 });

      const workbook = readBulkAdsWorkbook(await bulkAds.arrayBuffer());

      updateStep("parse-bulk-sp", { status: "active" });
      const spCampaigns = parseSpCampaignsFromWorkbook(workbook);
      updateStep("parse-bulk-sp", { status: "done", progress: 100 });

      updateStep("parse-bulk-sb", { status: "active" });
      const sbCampaigns = parseSbCampaignsFromWorkbook(workbook);
      updateStep("parse-bulk-sb", { status: "done", progress: 100 });

      updateStep("parse-bulk-sd", { status: "active" });
      const sdCampaigns = parseSdCampaignsFromWorkbook(workbook);
      updateStep("parse-bulk-sd", { status: "done", progress: 100 });

      updateStep("parse-bulk-sp-terms", { status: "active" });
      const spSearchTerms = parseSpSearchTermsFromWorkbook(workbook);
      updateStep("parse-bulk-sp-terms", { status: "done", progress: 100 });

      updateStep("parse-bulk-sb-terms", { status: "active" });
      const sbSearchTerms = parseSbSearchTermsFromWorkbook(workbook);
      updateStep("parse-bulk-sb-terms", { status: "done", progress: 100 });

      let keywords: string[] = [];
      if (brandKeywords) {
        updateStep("parse-brand-keywords", { status: "active" });
        keywords = parseBrandKeywords(await brandKeywords.arrayBuffer());
        updateStep("parse-brand-keywords", { status: "done", progress: 100 });
      }

      updateStep("save-data", { status: "active", progress: 0 });
      const totalRows =
        businessReportRows.length +
        spCampaigns.length +
        sbCampaigns.length +
        sdCampaigns.length +
        spSearchTerms.length +
        sbSearchTerms.length +
        keywords.length;
      let savedRows = 0;
      const onRowsInserted = (count: number) => {
        savedRows += count;
        updateStep("save-data", { progress: totalRows ? Math.round((savedRows / totalRows) * 100) : 100 });
      };

      await bulkInsert(supabase, "business_report_data", auditId, businessReportRows, 500, onRowsInserted);
      await bulkInsert(supabase, "sp_campaign_data", auditId, spCampaigns, 500, onRowsInserted);
      await bulkInsert(supabase, "sb_campaign_data", auditId, sbCampaigns, 500, onRowsInserted);
      await bulkInsert(supabase, "sd_campaign_data", auditId, sdCampaigns, 500, onRowsInserted);
      await bulkInsert(supabase, "sp_search_term_data", auditId, spSearchTerms, 500, onRowsInserted);
      await bulkInsert(supabase, "sb_search_term_data", auditId, sbSearchTerms, 500, onRowsInserted);
      if (keywords.length) {
        await bulkInsert(
          supabase,
          "brand_keywords",
          auditId,
          keywords.map((keyword) => ({ keyword })),
          500,
          onRowsInserted
        );
      }
      updateStep("save-data", { status: "done", progress: 100 });

      updateStep("finish", { status: "active" });
      const { error: statusError } = await supabase
        .from("audits")
        .update({ status: "complete" })
        .eq("id", auditId);
      if (statusError) throw new Error(statusError.message);
      updateStep("finish", { status: "done", progress: 100 });

      updateStep("cache-data", { status: "active" });
      try {
        const [freshData, brandName] = await Promise.all([
          fetchAuditData(supabase, auditId),
          fetchBrandName(supabase, brandId),
        ]);
        if (freshData) writeCache(cacheKeys.audit(auditId), { ...freshData, brandName });
        clearCache(cacheKeys.auditList(brandId));
      } catch {
        // Pre-caching is an optimization for the next page load — a failure here shouldn't block navigation.
      }
      updateStep("cache-data", { status: "done", progress: 100 });

      router.push(`/dashboard/${brandId}/audit/${auditId}`);
    } catch (err) {
      if (auditId) {
        await supabase.from("audits").update({ status: "draft" }).eq("id", auditId);
      }
      setError(err instanceof Error ? err.message : "Something went wrong while generating the audit.");
      setRunning(false);
      setSteps((prev) => prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s)));
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-xs text-neutral-400">
        <Link href="/dashboard" className="hover:text-navy">
          Brands
        </Link>{" "}
        /{" "}
        <Link href={`/dashboard/${brandId}`} className="hover:text-navy">
          Audits
        </Link>{" "}
        / <span className="text-navy">New Audit</span>
      </div>

      <h1 className="mb-6 text-xl font-bold text-navy">New Audit</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-black/5 bg-white p-5 shadow-sm sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy-light">
            Audit title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={running}
            placeholder="e.g. Q3 2026 PPC Audit"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green focus:ring-1 focus:ring-green disabled:opacity-60"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy-light">
            Marketplace
          </label>
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            disabled={running}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-green focus:ring-1 focus:ring-green disabled:opacity-60"
          >
            {MARKETPLACES.map((m) => (
              <option key={m.code} value={m.code}>
                {m.code} ({m.domain})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <UploadZone
          label="Business Report"
          description="CSV or Excel — single sheet, ASIN-level performance."
          accept=".csv,.xlsx,.xls"
          file={businessReport}
          onChange={setBusinessReport}
          disabled={running}
        />
        <UploadZone
          label="Bulk Ads File"
          description="Excel — must include Sponsored Products/Brands/Display Campaigns and SP/SB Search Term Report tabs."
          accept=".xlsx,.xls"
          file={bulkAds}
          onChange={setBulkAds}
          disabled={running}
        />
        <UploadZone
          label="SQP (Search Query Performance)"
          description="Optional — uploaded for reference. Processing coming soon."
          accept=".csv,.xlsx,.xls"
          file={sqp}
          onChange={setSqp}
          disabled={running}
        />
        <UploadZone
          label="Brand Keywords"
          description="Optional — CSV or Excel, single column list used for branded/non-branded classification. If skipped, all search terms are shown as non-branded."
          accept=".csv,.xlsx,.xls"
          file={brandKeywords}
          onChange={setBrandKeywords}
          disabled={running}
          extra={
            <a
              href="/templates/brand-keywords-template.csv"
              download
              className="text-xs font-medium text-green hover:underline"
            >
              Download template
            </a>
          }
        />
        <UploadZone
          label="Top Keywords"
          description="Optional — uploaded for reference. Processing coming soon."
          accept=".csv,.xlsx,.xls"
          file={topKeywords}
          onChange={setTopKeywords}
          disabled={running}
        />
      </div>

      {running && steps.length > 0 && <ProgressSteps steps={steps} />}

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={!canSubmit}
        className="mt-6 w-full rounded-md bg-green px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "Generating…" : "Generate Audit"}
      </button>
    </div>
  );
}
