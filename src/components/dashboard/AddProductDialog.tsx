"use client";

import { useState, useRef } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createProduct(formData);
      formRef.current?.reset();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 ms-2" />إضافة منتج</Button>} />
        
      
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة منتج جديد</DialogTitle></DialogHeader>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
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
          <DialogFooter>
            <Button type="submit" disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}