"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
import { deleteProduct, updateProduct } from "@/app/actions";

export type ProductActionsProduct = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  minQuantity: number;
};

function EditProductDialog({ product }: { product: ProductActionsProduct }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const result = await updateProduct(formData);
      if (!result.ok) {
        setError(result.error ?? "حدث خطأ غير متوقع");
        return;
      }
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
          <Button variant="ghost" size="icon" aria-label="تعديل المنتج">
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل المنتج</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={product.id} />
          <div className="space-y-2">
            <Label htmlFor="edit-name">الاسم</Label>
            <Input id="edit-name" name="name" defaultValue={product.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-sku">الرمز (SKU)</Label>
            <Input id="edit-sku" name="sku" defaultValue={product.sku} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-unit">الوحدة</Label>
              <Input id="edit-unit" name="unit" defaultValue={product.unit} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-min">حد التنبيه الأدنى</Label>
              <Input
                id="edit-min"
                name="minQuantity"
                type="number"
                step="any"
                min="0"
                defaultValue={product.minQuantity}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            تُعدَّل الكمية عبر حركات المخزون فقط، للحفاظ على سجل التتبع.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProductDialog({ product }: { product: ProductActionsProduct }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const result = await deleteProduct(product.id);
      if (!result.ok) {
        setError(result.error ?? "حدث خطأ غير متوقع");
        return;
      }
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="حذف المنتج"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>حذف المنتج</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          هل تريد حذف «{product.name}»؟ لا يمكن التراجع عن هذا الإجراء.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "جارٍ الحذف..." : "حذف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductActions({ product }: { product: ProductActionsProduct }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <EditProductDialog product={product} />
      <DeleteProductDialog product={product} />
    </div>
  );
}
