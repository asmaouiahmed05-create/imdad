import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/authz";

export default async function SalesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePagePermission("sales.read");
  return children;
}
