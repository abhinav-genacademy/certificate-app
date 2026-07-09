"use client";

import { useState } from "react";

type Certificate = {
  firstName: string;
  courseName: string;
  cohortLabel: string;
  credentialId: string;
  certificateUrl: string;
  verifyUrl: string;
  issuedAt: string;
  linkedInAddUrl: string;
};

type ClaimResult =
  | { status: "issued"; certificates: Certificate[] }
  | { status: "pending"; message: string; actionUrl?: string; actionLabel?: string }
  | { status: "revoked"; message: string };

export default function HomePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg flex flex-col gap-7">
        <div className="text-center">
          <div className="text-[13px] tracking-[6px] text-academy-yellow font-semibold uppercase">
            The Gen Academy
          </div>
          <h1 className="text-3xl font-bold mt-3">Find your certificate</h1>
          <p className="text-muted-grey text-sm mt-2">
            Enter your details exactly as they were submitted for your cohort.
          </p>
        </div>

        {!result && (
          <form onSubmit={handleSubmit} className="brand-card p-9 flex flex-col gap-5">
            <div className="flex gap-4">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[2px] text-muted-grey">
                  First name
                </label>
                <input
                  className="brand-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[2px] text-muted-grey">
                  Last name
                </label>
                <input
                  className="brand-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
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
            <button type="submit" className="brand-button mt-1" disabled={loading}>
              {loading ? "Checking..." : "Find my certificate"}
            </button>
          </form>
        )}

        {result?.status === "pending" && (
          <div className="brand-card p-9 text-center flex flex-col items-center gap-3">
            <p>{result.message}</p>
            {result.actionUrl && (
              <a href={result.actionUrl} target="_blank" className="brand-button mt-3">
                {result.actionLabel ?? "Continue"}
              </a>
            )}
            <button className="brand-button-secondary mt-3" onClick={() => setResult(null)}>
              Try again
            </button>
          </div>
        )}

        {result?.status === "revoked" && (
          <div className="brand-card p-9 text-center">
            <div className="text-3xl mb-2">⚠️</div>
            <p className="text-red-400 font-semibold">{result.message}</p>
            <button className="brand-button-secondary mt-6" onClick={() => setResult(null)}>
              Try again
            </button>
          </div>
        )}

        {result?.status === "issued" &&
          result.certificates.map((cert) => (
            <div key={cert.credentialId} className="brand-card p-9 flex flex-col gap-6">
              <div className="text-center">
                <div className="text-3xl mb-2">🎉</div>
                <h2 className="text-xl font-bold">Your certificate has been issued!</h2>
                <p className="text-muted-grey mt-1.5">
                  You&apos;re certified, {cert.firstName}.
                </p>
                <p className="text-academy-yellow font-semibold mt-1.5">
                  {cert.courseName} &ndash; {cert.cohortLabel}
                </p>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[2px] text-muted-grey">
                  Your credential ID
                </div>
                <div className="font-mono text-lg mt-1.5">{cert.credentialId}</div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[2px] text-muted-grey">
                  Shareable verification link
                </div>
                <a
                  href={cert.verifyUrl}
                  target="_blank"
                  className="text-sm text-academy-yellow hover:underline break-all"
                >
                  {cert.verifyUrl}
                </a>
              </div>

              <div className="flex gap-3">
                <a href={cert.verifyUrl} target="_blank" className="brand-button">
                  View certificate
                </a>
                <a href={cert.linkedInAddUrl} target="_blank" className="brand-button-secondary">
                  Add to LinkedIn
                </a>
              </div>

              <p className="text-xs text-muted-grey text-center">
                Anyone who clicks your link lands on your verified certificate page on The Gen
                Academy.
              </p>
            </div>
          ))}

        {result && (
          <button
            className="text-sm text-muted-grey hover:text-academy-yellow self-center"
            onClick={() => setResult(null)}
          >
            Search again
          </button>
        )}
      </div>
    </main>
  );
}
