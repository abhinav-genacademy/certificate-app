"use client";

import { useState } from "react";
import type { CertificateTheme } from "@/lib/certificate-template";

export function ThemeSwitcher({
  credentialId,
  initialTheme,
  initialCertificateUrl,
  recipientLabel,
}: {
  credentialId: string;
  initialTheme: CertificateTheme;
  initialCertificateUrl: string;
  recipientLabel: string;
}) {
  const [theme, setTheme] = useState<CertificateTheme>(initialTheme);
  const [certificateUrl, setCertificateUrl] = useState(initialCertificateUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(next: CertificateTheme) {
    if (next === theme || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/verify/${credentialId}/theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update style");
        return;
      }
      setTheme(next);
      setCertificateUrl(data.certificateUrl);
    } catch {
      setError("Failed to update style");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <img
        src={certificateUrl}
        alt={recipientLabel}
        className="w-full rounded-lg border border-white/10"
      />

      <div className="flex flex-col gap-2 items-center">
        <div className="text-xs uppercase tracking-[2px] text-muted-grey">Certificate style</div>
        <div className="flex gap-3 w-full max-w-xs">
          {(["light", "dark"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={loading}
              onClick={() => pick(option)}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-semibold capitalize transition-colors disabled:opacity-50 ${
                theme === option
                  ? "border-academy-yellow text-academy-yellow"
                  : "border-white/15 text-muted-grey hover:border-white/30"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
