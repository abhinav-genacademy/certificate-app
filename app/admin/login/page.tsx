"use client";

import { useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }
      const adminBase = "/" + pathname.split("/").filter(Boolean)[0];
      const from = searchParams.get("from") ?? adminBase;
      router.push(from);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="brand-card w-full max-w-sm p-8 flex flex-col gap-5">
      <div>
        <div className="text-[13px] tracking-[6px] text-academy-yellow font-semibold uppercase">
          The Gen Academy
        </div>
        <h1 className="text-2xl font-bold mt-2">Admin sign in</h1>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs uppercase tracking-[2px] text-muted-grey">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoFocus
          className="brand-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs uppercase tracking-[2px] text-muted-grey">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="brand-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" className="brand-button" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
