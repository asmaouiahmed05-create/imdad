"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function PurchasingError({
  error,
  reset,
  label,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  label: string;
}) {
  useEffect(() => {
    console.error(`${label} page failed to load`, error);
  }, [error, label]);

  return (
    <main className="mx-auto flex min-h-96 w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-lg font-semibold text-white">تعذّر تحميل {label}</h2>
      <p className="max-w-md text-sm leading-6 text-slate-400">
        حدث خطأ أثناء تحميل البيانات. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-500">
          رقم الخطأ: <span dir="ltr">{error.digest}</span>
        </p>
      )}
      <Button type="button" onClick={reset} className="mt-2">
        إعادة المحاولة
      </Button>
    </main>
  );
}
