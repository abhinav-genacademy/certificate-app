"use client";

import { usePathname, useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    const adminBase = "/" + pathname.split("/").filter(Boolean)[0];
    router.push(`${adminBase}/login`);
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="brand-button-secondary text-sm">
      Sign out
    </button>
  );
}
