"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const authClient = createAuthClient();

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  if (isPending || !session) return null;

  async function signOut() {
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(true);
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 border-white/[0.08] bg-slate-900/80 px-3 text-slate-200 hover:bg-slate-800 hover:text-white"
        onClick={signOut}
      >
        تسجيل الخروج
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-rose-300">
          تعذّر تسجيل الخروج. حاول مرة أخرى.
        </span>
      ) : null}
    </>
  );
}
