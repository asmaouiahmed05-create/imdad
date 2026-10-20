import { Suspense } from "react";
import { Bell, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductSearch } from "@/components/dashboard/ProductSearch";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-slate-950/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-white sm:text-lg">
            إدارة المخازن
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">لوحة التحكم الرئيسية</p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-3">
          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-slate-900/80 sm:w-56 lg:w-72"
              />
            }
          >
            <ProductSearch />
          </Suspense>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="الإشعارات"
            className="relative size-10 rounded-xl border-white/[0.08] bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Bell aria-hidden="true" className="size-[18px]" />
            <span className="absolute end-2 top-2 size-1.5 rounded-full bg-rose-400 ring-2 ring-slate-900" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="الإعدادات"
            className="hidden size-10 rounded-xl border-white/[0.08] bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white sm:inline-flex"
          >
            <Settings2 aria-hidden="true" className="size-[18px]" />
          </Button>
        </div>
      </div>
    </header>
  );
}
