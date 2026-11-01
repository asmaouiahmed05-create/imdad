"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { transitionBom } from "@/app/production/boms/actions";
import type { BomStatus } from "@/lib/production-bom";

export function BomTransitionControls({
  id,
  status,
  canManage,
}: {
  id: string;
  status: BomStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const [dialogAction, setDialogAction] = useState<"release" | "retire" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmTransition() {
    if (!dialogAction) return;
    const action = dialogAction;
    setError(null);
    startTransition(async () => {
      try {
        const result = await transitionBom(id, action);
        if (!result.ok) {
          setError(result.error ?? "تعذّر تغيير الحالة");
          return;
        }
        setDialogAction(null);
        router.refresh();
      } catch {
        setError("تعذّر تنفيذ الإجراء، تحقق من صلاحيتك وحاول مجددًا");
      }
    });
  }

  return (
    <>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" && (
            <>
              <Button
                variant="outline"
                render={<Link href={`/production/boms/${id}/edit`} />}
              >
                تعديل المسودة
              </Button>
              <Button onClick={() => setDialogAction("release")}>
                اعتماد المراجعة
              </Button>
            </>
          )}
          {status === "RELEASED" && (
            <>
              <Button
                variant="outline"
                render={<Link href={`/production/boms/new?sourceId=${id}`} />}
              >
                إنشاء مراجعة جديدة
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialogAction("retire")}
              >
                تقاعد المراجعة
              </Button>
            </>
          )}
          {status === "RETIRED" && (
            <Button
              variant="outline"
              render={<Link href={`/production/boms/new?sourceId=${id}`} />}
            >
              إنشاء مراجعة جديدة
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <Dialog
        open={dialogAction !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setDialogAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "release"
                ? "اعتماد مراجعة قائمة المواد"
                : "تقاعد مراجعة قائمة المواد"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-6 text-slate-300">
            {dialogAction === "release"
              ? "سيتم قفل هذه المراجعة نهائيًا. لا يمكن تعديلها بعد الاعتماد، ويمكن إجراء التغييرات بإنشاء مراجعة جديدة."
              : "ستبقى المراجعة محفوظة للتاريخ، لكن لن يمكن إعادة تفعيلها أو تعديلها."}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDialogAction(null)}
            >
              رجوع
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={confirmTransition}
            >
              {isPending ? "جارٍ التحديث..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
