"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateOneButton({
  cohortId,
  studentId,
}: {
  cohortId: string;
  studentId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cohorts/${cohortId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, force: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate");
        return;
      }
      if (data.failed?.length) {
        setError(data.failed[0].error ?? "Failed to generate");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-academy-yellow hover:underline disabled:opacity-50"
        title="Generate this person's certificate now, regardless of the Week 2/3 check"
      >
        {loading ? "Generating..." : "Generate"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
