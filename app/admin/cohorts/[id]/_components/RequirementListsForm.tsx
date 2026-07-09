"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

function UploadRow({
  cohortId,
  week,
  label,
  count,
}: {
  cohortId: string;
  week: "week2" | "week3";
  label: string;
  count: number | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; skipped: number; rosterSize: number } | null>(
    null
  );

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
      formData.append("week", week);
      const res = await fetch(`/api/admin/cohorts/${cohortId}/requirements`, {
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
      // Blob's list() has been observed lagging behind a just-completed
      // write past the server-side retry window in lib/blob-store.ts — a
      // second refresh a couple seconds later catches the roster up if the
      // first one rendered before the write was visible.
      setTimeout(() => router.refresh(), 2500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-grey text-right">
          {count === null ? "Not uploaded yet" : `${count} submitted`}
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
          {result.count} submission(s) loaded{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}
          . Roster now has {result.rosterSize} student(s).
        </p>
      )}
    </form>
  );
}

export function RequirementListsForm({
  cohortId,
  week2Count,
  week3Count,
}: {
  cohortId: string;
  week2Count: number | null;
  week3Count: number | null;
}) {
  return (
    <div className="brand-card p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold">Project requirement lists</h2>
        <p className="text-sm text-muted-grey mt-1">
          The roster is built automatically from whoever appears in <em>both</em> lists below —
          there's no separate roster upload. Re-uploading either one rebuilds the roster to match;
          anyone manually added (right) is kept regardless.
        </p>
      </div>
      <UploadRow cohortId={cohortId} week="week2" label="Week 2 Project" count={week2Count} />
      <UploadRow cohortId={cohortId} week="week3" label="Week 3 Project" count={week3Count} />
    </div>
  );
}
