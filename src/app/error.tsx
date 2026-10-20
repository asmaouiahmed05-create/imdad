"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Inventory dashboard failed to load", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-96 w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
      <h2 className="text-lg font-semibold text-white">
        تعذّر تحميل بيانات المخزون
      </h2>
      <p className="max-w-md text-sm leading-6 text-slate-400">
        حدث خطأ أثناء تحميل لوحة المخزون. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-500">
          رقم الخطأ: <span dir="ltr">{error.digest}</span>
        </p>
      )}
      <Button
        type="button"
        onClick={reset}
        className="mt-2 bg-sky-500 text-white hover:bg-sky-400"
      >
        إعادة المحاولة
      </Button>
    </main>
  );
}
