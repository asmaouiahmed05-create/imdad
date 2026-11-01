"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Activity,
  Building2,
  Factory,
  FileSpreadsheet,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserRoundCog,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const navGroups: {
  label: string;
  items: { label: string; icon: LucideIcon; href: string; featured?: boolean }[];
}[] = [
  {
    label: "نظرة الإدارة",
    items: [
      {
        label: "برج مراقبة سلسلة التوريد",
        icon: Activity,
        href: "/control-tower",
        featured: true,
      },
    ],
  },
  {
    label: "عمليات سلسلة التوريد",
    items: [
      { label: "الموردون", icon: Building2, href: "/suppliers" },
      { label: "المشتريات", icon: ShoppingCart, href: "/purchase-orders" },
      { label: "المخزون والمستودعات", icon: Warehouse, href: "/" },
      { label: "الإنتاج والعمليات", icon: Factory, href: "/production" },
      { label: "المبيعات وطلبات العملاء", icon: ShoppingBag, href: "/sales" },
      { label: "التوزيع والتوصيل", icon: Truck, href: "/distribution" },
    ],
  },
  {
    label: "الإدارة والتحليلات",
    items: [
      {
        label: "التقارير والتحليلات",
        icon: FileSpreadsheet,
        href: "/reports",
      },
      {
        label: "إدارة المستخدمين والصلاحيات",
        icon: UserRoundCog,
        href: "/users",
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-white/[0.07] bg-slate-900/90 px-4 py-4 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:overflow-y-auto md:border-b-0 md:border-e md:px-5 md:py-6">
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

      <nav
        aria-label="القائمة الرئيسية"
        className="mt-7 flex flex-col gap-4"
      >
        {navGroups.map(({ label: groupLabel, items }) => (
          <section key={groupLabel} className="min-w-0">
            <h2 className="mb-2 px-3 text-[10px] font-semibold tracking-wide text-slate-500">
              {groupLabel}
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
              {items.map(({ label, icon: Icon, href, featured = false }) => {
                const active =
                  href === "/"
                    ? pathname === "/"
                    : pathname === href || pathname.startsWith(`${href}/`);
                const linkStyle = active
                  ? featured
                    ? "border-sky-400/30 bg-gradient-to-r from-sky-500 to-blue-600 font-semibold text-white shadow-lg shadow-sky-950/30"
                    : "border-transparent bg-sky-500 font-semibold text-white shadow-lg shadow-sky-950/30"
                  : featured
                    ? "border-sky-400/20 bg-sky-400/[0.06] font-semibold text-sky-200 hover:bg-sky-400/[0.12]"
                    : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white";

                return (
                  <Link
                    key={label}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl border px-3.5 text-sm transition md:w-full ${linkStyle}`}
                  >
                    <Icon aria-hidden="true" className="size-[18px]" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
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
          <p className="truncate text-xs font-medium text-slate-200">مستخدم النظام</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">جلسة مصادقة</p>
        </div>
      </div>
    </aside>
  );
}
