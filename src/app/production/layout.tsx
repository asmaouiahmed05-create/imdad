import type { ReactNode } from "react";
import { ProductionDemoProvider } from "@/components/production/ProductionDemoProvider";

export default function ProductionLayout({ children }: { children: ReactNode }) {
  return <ProductionDemoProvider>{children}</ProductionDemoProvider>;
}
