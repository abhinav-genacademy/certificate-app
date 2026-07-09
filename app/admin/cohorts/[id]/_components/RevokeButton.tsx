"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeButton({
  cohortId,
  studentId,
  revoked,
}: {
  cohortId: string;
  studentId: string;
  revoked: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const confirmMessage = revoked
      ? "Restore this certificate? It will become valid again at the same verification link."
      : "Revoke this certificate? It will immediately stop verifying as valid.";
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      await fetch(`/api/admin/cohorts/${cohortId}/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoked: !revoked }),
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
      className={
        revoked
          ? "text-academy-yellow hover:underline disabled:opacity-50"
          : "text-red-400 hover:underline disabled:opacity-50"
      }
    >
      {loading ? "..." : revoked ? "Restore" : "Revoke"}
    </button>
  );
}
