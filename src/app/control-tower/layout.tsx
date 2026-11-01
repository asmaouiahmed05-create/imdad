import type { ReactNode } from "react";
import { DistributionDemoProvider } from "@/components/distribution/DistributionDemoProvider";
import { ProductionDemoProvider } from "@/components/production/ProductionDemoProvider";
import { SalesDemoProvider } from "@/components/sales/SalesDemoProvider";

export default function ControlTowerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SalesDemoProvider>
      <DistributionDemoProvider>
        <ProductionDemoProvider>{children}</ProductionDemoProvider>
      </DistributionDemoProvider>
    </SalesDemoProvider>
  );
}
