import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/authz";

export default async function DistributionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePagePermission("distribution.read");
  return children;
}
