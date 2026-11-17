"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="button quiet"
      style={{ padding: 0 }}
      onClick={async () => {
        await fetch("/api/v1/session/logout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
