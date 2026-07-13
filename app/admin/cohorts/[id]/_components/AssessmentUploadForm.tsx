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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; skipped: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
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
      setResult(data);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="brand-card p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">Final assessment scores</h2>
        <p className="text-sm text-muted-grey mt-1">
          Fallback for cohorts not using the Google Form quiz integration — upload a CSV of emails
          and scores. Score can be a raw fraction (e.g. <code>42/50</code>) or a percentage — either
          way, only students scoring above 80% are eligible for their certificate. Re-uploading
          replaces the previous list.
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
          <button type="submit" className="brand-button" disabled={loading}>
            {loading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <p className="text-xs text-muted-grey">
            {result.count} score(s) loaded{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
          </p>
        )}
      </form>
    </div>
  );
}
