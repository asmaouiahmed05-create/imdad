"use client";

import { useRef, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordMovement } from "@/app/actions";
import {
  MAX_INVENTORY_DECIMAL_PLACES,
  MAX_INVENTORY_QUANTITY,
} from "@/lib/inventory-quantity";

type ProductOption = { id: string; name: string; sku: string; unit: string };

const quantityStep = 10 ** -MAX_INVENTORY_DECIMAL_PLACES;
const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function RecordMovementDialog({ products }: { products: ProductOption[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await recordMovement(formData);
      if (!result.ok) {
        setError(result.error ?? "حدث خطأ غير متوقع");
        return;
      }
      formRef.current?.reset();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" disabled={products.length === 0}>
            <ArrowDownUp className="size-4" />
            حركة مخزون
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تسجيل حركة مخزون</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productId">المنتج</Label>
            <select id="productId" name="productId" required className={selectClass}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.sku} ({p.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">نوع الحركة</Label>
              <select id="type" name="type" required className={selectClass}>
                <option value="IN">استلام (إدخال)</option>
                <option value="OUT">صرف (إخراج)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movement-quantity">الكمية</Label>
              <Input
                id="movement-quantity"
                name="quantity"
                type="number"
                step={quantityStep}
                min={quantityStep}
                max={MAX_INVENTORY_QUANTITY}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">السبب (اختياري)</Label>
            <Input id="reason" name="reason" placeholder="شراء من مورد، استهلاك في الإنتاج..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">المرجع (اختياري)</Label>
            <Input id="reference" name="reference" placeholder="رقم وصل أو فاتورة" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "جارٍ الحفظ..." : "تسجيل"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
