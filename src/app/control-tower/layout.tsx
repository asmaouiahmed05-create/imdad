import type { ReactNode } from "react";
import { SalesDemoProvider } from "@/components/sales/SalesDemoProvider";

export default function ControlTowerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SalesDemoProvider>
      {children}
    </SalesDemoProvider>
  );
}
