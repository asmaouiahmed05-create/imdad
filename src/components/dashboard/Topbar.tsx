import { Bell, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
          <label className="relative min-w-0 flex-1 sm:w-56 lg:w-72">
            <span className="sr-only">ابحث عن صنف</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            />
            <Input
              type="search"
              placeholder="ابحث عن صنف..."
              className="h-10 rounded-xl border-white/[0.08] bg-slate-900/80 ps-10 pe-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-sky-400/40 focus-visible:ring-sky-400/15"
            />
          </label>
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
