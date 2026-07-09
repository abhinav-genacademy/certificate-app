"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton({
  cohortId,
  pendingCount,
}: {
  cohortId: string;
  pendingCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(pendingCount);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      let stillPending = remaining;
      while (stillPending > 0) {
        const res = await fetch(`/api/admin/cohorts/${cohortId}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Certificate generation failed");
          return;
        }
        if (data.failed?.length) {
          const details = data.failed
            .map((f: { studentId: string; error: string }) => f.error)
            .join(" | ");
          setError(`${data.failed.length} certificate(s) failed to generate: ${details}`);
        }
        if (data.notEligible?.length) {
          setNotice(`${data.notEligible.length} not eligible yet — missing project submissions.`);
        }
        const previousPending = stillPending;
        stillPending = data.remainingPending;
        setRemaining(stillPending);
        // No progress this round (everyone left is failing or not yet
        // eligible) — stop instead of polling the same result forever.
        if (stillPending === previousPending) break;
      }
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  if (pendingCount === 0 && remaining === 0) {
    return <span className="text-sm text-muted-grey">All certificates issued</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleGenerate} className="brand-button" disabled={loading}>
        {loading ? `Generating... (${remaining} left)` : `Generate ${remaining} certificate(s)`}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
      {!error && notice && <span className="text-sm text-muted-grey">{notice}</span>}
    </div>
  );
}
