"use client";

import { PurchasingError } from "@/components/purchasing/PurchasingError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PurchasingError error={error} reset={reset} label="أوامر الشراء" />;
}
