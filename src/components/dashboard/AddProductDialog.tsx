"use client";

import { useState, useRef, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProduct } from "@/app/actions";

export function AddProductDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const result = await createProduct(formData);
      if (!result.ok) {
        setError(result.error ?? "حدث خطأ غير متوقع");
        return;
      }
      formRef.current?.reset();
      setOpen(false);
    } catch {
      setError("تعذّر الاتصال بالخادم، حاول مرة أخرى");
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
      <DialogTrigger render={<Button><Plus className="h-4 w-4 ms-2" />إضافة منتج</Button>} />
        
      
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة منتج جديد</DialogTitle></DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">الاسم</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">الرمز (SKU)</Label>
            <Input id="sku" name="sku" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">الوحدة</Label>
              <Input id="unit" name="unit" placeholder="قطعة، كغ..." required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">الكمية</Label>
              <Input id="quantity" name="quantity" type="number" step="any" defaultValue={0} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minQuantity">حد التنبيه الأدنى</Label>
            <Input id="minQuantity" name="minQuantity" type="number" step="any" defaultValue={0} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}