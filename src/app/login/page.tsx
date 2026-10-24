import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "تسجيل الدخول | ImdadDZ",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-12">
      <section className="w-full space-y-6 rounded-2xl border border-white/10 bg-slate-900 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-slate-400">
            سجّل الدخول باستخدام الحساب الذي أنشأه مسؤول النظام.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
