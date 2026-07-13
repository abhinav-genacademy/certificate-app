"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AssessmentUploadForm({
  cohortId,
  count,
}: {
  cohortId: string;
  count: number | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    count: number;
    skipped: number;
    generated: number;
  } | null>(null);

  // Mirrors GenerateButton's loop — the generate endpoint already factors
  // assessment scores into eligibility, so re-running it right after upload
  // is exactly "auto-issue certificates for anyone newly above 80%". Batched
  // server-side (BATCH_SIZE in the generate route) so this stays within
  // serverless time limits regardless of cohort size.
  async function generatePendingEligible(): Promise<number> {
    let generated = 0;
    let remaining = Infinity;
    while (remaining > 0) {
      const res = await fetch(`/api/admin/cohorts/${cohortId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) break;
      generated += data.processed ?? 0;
      const previousRemaining = remaining;
      remaining = data.remainingPending ?? 0;
      // No progress this round (everyone left is failing or still not
      // eligible) — stop instead of looping on the same result forever.
      if (remaining === previousRemaining) break;
    }
    return generated;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setPhase("uploading");
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/cohorts/${cohortId}/assessment`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setPhase("generating");
      const generated = await generatePendingEligible();
      setResult({ count: data.count, skipped: data.skipped, generated });
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="brand-card p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">Final assessment scores</h2>
        <p className="text-sm text-muted-grey mt-1">
          Fallback for cohorts not using the Google Form quiz integration — upload a CSV of emails
          and scores. Score can be a raw fraction (e.g. <code>42/50</code>) or a percentage — either
          way, only students scoring above 80% are eligible. Certificates for anyone newly eligible
          are generated automatically right after upload. Re-uploading replaces the previous list.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Assessment results</span>
          <span className="text-xs text-muted-grey text-right">
            {count === null ? "Not uploaded yet" : `${count} scored`}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="brand-input flex-1"
            required
          />
          <button type="submit" className="brand-button" disabled={phase !== "idle"}>
            {phase === "uploading"
              ? "Uploading..."
              : phase === "generating"
                ? "Generating certificates..."
                : "Upload"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <p className="text-xs text-muted-grey">
            {result.count} score(s) loaded{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
            {result.generated > 0
              ? ` ${result.generated} certificate(s) generated.`
              : " No new certificates were eligible yet."}
          </p>
        )}
      </form>
    </div>
  );
}
