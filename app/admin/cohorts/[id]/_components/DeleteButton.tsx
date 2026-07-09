"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({
  cohortId,
  studentId,
  studentName,
}: {
  cohortId: string;
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (
      !window.confirm(
        `Remove ${studentName} from this cohort's roster? This can't be undone from here — if they're derived from the Week 2/3 lists and still appear in both, they'll come back the next time either is re-uploaded.`
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      await fetch(`/api/admin/cohorts/${cohortId}/students/${studentId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-red-400 hover:underline disabled:opacity-50"
    >
      {loading ? "..." : "Delete"}
    </button>
  );
}
