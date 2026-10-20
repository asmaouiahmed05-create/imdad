"use client";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProductSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentParams = searchParams.toString();
  const currentQuery = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState<{
    value: string;
    baseQuery: string;
  } | null>(null);
  const value = draft?.baseQuery === currentQuery ? draft.value : currentQuery;
  const [isPending, startTransition] = useTransition();

  const applySearch = useCallback((nextValue: string) => {
    const params = new URLSearchParams(currentParams);
    const query = nextValue.trim().slice(0, 100);

    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
    params.delete("page");

    const queryString = params.toString();
    const destination = queryString ? `${pathname}?${queryString}` : pathname;
    if (destination !== `${pathname}${currentParams ? `?${currentParams}` : ""}`) {
      startTransition(() => router.replace(destination, { scroll: false }));
    }
  }, [currentParams, pathname, router]);

  useEffect(() => {
    const query = value.trim().slice(0, 100);
    if (query === currentQuery) return;

    const timeout = window.setTimeout(() => applySearch(query), 350);
    return () => window.clearTimeout(timeout);
  }, [value, currentQuery, applySearch]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applySearch(value);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex w-full items-center gap-2 sm:w-auto sm:gap-3"
    >
      <label className="relative min-w-0 flex-1 sm:w-56 lg:w-72">
        <span className="sr-only">ابحث باسم الصنف أو رمز SKU</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
        />
        <Input
          type="search"
          dir="auto"
          value={value}
          onChange={(event) =>
            setDraft({ value: event.target.value, baseQuery: currentQuery })
          }
          placeholder="ابحث باسم الصنف أو SKU..."
          maxLength={100}
          className="h-10 rounded-xl border-white/[0.08] bg-slate-900/80 ps-10 pe-10 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-sky-400/40 focus-visible:ring-sky-400/15"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="مسح البحث"
            onClick={() => setDraft({ value: "", baseQuery: currentQuery })}
            className="absolute end-1 top-1/2 size-8 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        )}
      </label>
      <Button
        type="submit"
        variant="outline"
        disabled={isPending}
        className="h-10 border-white/[0.08] bg-slate-900/80 px-3 text-slate-200 hover:bg-slate-800 hover:text-white"
      >
        بحث
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? "جارٍ تحديث نتائج البحث" : ""}
      </span>
    </form>
  );
}
