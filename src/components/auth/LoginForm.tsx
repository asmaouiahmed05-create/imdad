"use client";

import { useState, type FormEvent } from "react";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const authClient = createAuthClient();

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      if (result.error) {
        setError("تعذّر تسجيل الدخول. تحقق من بيانات الحساب.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بخدمة تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block space-y-2 text-sm text-slate-300">
        <span>البريد الإلكتروني</span>
        <input
          autoComplete="username"
          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block space-y-2 text-sm text-slate-300">
        <span>كلمة المرور</span>
        <input
          autoComplete="current-password"
          className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white"
          name="password"
          required
          type="password"
        />
      </label>
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}
