import type { ReactNode } from "react";
import { DistributionDemoProvider } from "@/components/distribution/DistributionDemoProvider";
import { SalesDemoProvider } from "@/components/sales/SalesDemoProvider";

export default function DistributionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SalesDemoProvider>
      <DistributionDemoProvider>{children}</DistributionDemoProvider>
    </SalesDemoProvider>
  );
}
