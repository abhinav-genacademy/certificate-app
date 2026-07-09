"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateCohortForm({ adminBase }: { adminBase: string }) {
  const router = useRouter();
  const [courseName, setCourseName] = useState("");
  const [cohortLabel, setCohortLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseName, cohortLabel }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error ?? `Failed to create cohort (status ${res.status})`);
        return;
      }
      setCourseName("");
      setCohortLabel("");
      router.push(`${adminBase}/cohorts/${data.cohort.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create cohort");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="brand-card p-7 flex flex-col gap-5 h-fit">
      <h2 className="text-lg font-bold">New cohort</h2>
      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-[2px] text-muted-grey">Course name</label>
        <input
          className="brand-input"
          placeholder="Mastering Agentic AI"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-[2px] text-muted-grey">Cohort label</label>
        <input
          className="brand-input"
          placeholder="Cohort 3"
          value={cohortLabel}
          onChange={(e) => setCohortLabel(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" className="brand-button self-start" disabled={loading}>
        {loading ? "Creating..." : "Create cohort"}
      </button>
    </form>
  );
}
