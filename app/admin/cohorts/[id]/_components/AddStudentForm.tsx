"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddStudentForm({ cohortId }: { cohortId: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cohorts/${cohortId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add student");
        return;
      }
      setFirstName("");
      setLastName("");
      setEmail("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="brand-card p-6 flex flex-col gap-4">
      <h2 className="text-lg font-bold">Add student</h2>
      <p className="text-sm text-muted-grey">
        For exceptions the Week 2/3 lists missed — this person skips the requirement check and
        won't be removed if the lists are re-uploaded. Adding an email already in this cohort
        updates their name instead of duplicating them.
      </p>
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-xs uppercase tracking-[2px] text-muted-grey">First name</label>
          <input
            className="brand-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-xs uppercase tracking-[2px] text-muted-grey">Last name</label>
          <input
            className="brand-input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-[2px] text-muted-grey">Email</label>
        <input
          type="email"
          className="brand-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button type="submit" className="brand-button self-start" disabled={loading}>
        {loading ? "Adding..." : "Add student"}
      </button>
    </form>
  );
}
