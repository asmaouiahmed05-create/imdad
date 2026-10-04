import Link from "next/link";
import { Boxes, Factory, Truck, Warehouse } from "lucide-react";

const navItems = [
  { label: "المخازن", icon: Warehouse, active: true },
  { label: "الإنتاج", icon: Factory, active: false },
  { label: "سلاسل الإمداد", icon: Truck, active: false },
];

export function Sidebar() {
  return (
    <aside className="border-b border-white/[0.07] bg-slate-900/90 px-4 py-4 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-e md:px-5 md:py-6">
      <div className="flex items-center gap-3 px-1">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-950/40">
          <Boxes aria-hidden="true" className="size-5" />
        </div>
        <div>
          <p className="text-base font-bold tracking-tight text-white">ImdadDZ</p>
          <p className="mt-0.5 text-[10px] font-medium tracking-[0.16em] text-slate-500">
            WAREHOUSE SUITE
          </p>
        </div>
      </div>

      <div className="mt-7 hidden px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500 md:block">
        القائمة الرئيسية
      </div>
      <nav
        aria-label="القائمة الرئيسية"
        className="mt-4 flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0"
      >
        {navItems.map(({ label, icon: Icon, active }) =>
          active ? (
            <Link
              key={label}
              href="/"
              aria-current="page"
              className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl bg-sky-500 px-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 md:w-full"
            >
              <Icon aria-hidden="true" className="size-[18px]" />
              <span>{label}</span>
            </Link>
          ) : (
            <div
              key={label}
              aria-disabled="true"
              className="flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-sm text-slate-500 opacity-55 md:w-full"
            >
              <Icon aria-hidden="true" className="size-[18px]" />
              <span className="whitespace-nowrap">{label}</span>
              <span className="ms-auto rounded-full border border-slate-700/80 bg-slate-800/70 px-2 py-0.5 text-[10px] text-slate-400">
                قريبًا
              </span>
            </div>
          ),
        )}
      </nav>

      <div className="mt-8 hidden rounded-2xl border border-sky-400/10 bg-gradient-to-br from-sky-400/[0.08] to-indigo-400/[0.03] p-4 md:block">
        <div className="mb-3 grid size-8 place-items-center rounded-lg bg-sky-400/10 text-sky-300">
          <Warehouse aria-hidden="true" className="size-4" />
        </div>
        <p className="text-sm font-medium text-slate-200">مساحة العمل</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          أدوات إدارة المخزون في مكان واحد.
        </p>
      </div>

      <div className="mt-auto hidden border-t border-white/[0.07] pt-5 md:flex md:items-center md:gap-3">
        <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 text-sm font-semibold text-white">
          م
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-200">مدير المخازن</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">مسؤول النظام</p>
        </div>
      </div>
    </aside>
  );
}
