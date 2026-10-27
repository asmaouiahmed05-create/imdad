"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserRoundPlus } from "lucide-react";
import {
  changeManagedUserRole,
  createManagedUser,
  disableManagedUser,
} from "@/app/user-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { APP_ROLES, type AppRole } from "@/lib/authorization";

type ManagedUserView = {
  id: string;
  name: string;
  email: string;
  role: AppRole | null;
  disabled: boolean;
  createdAt: string;
};

const roleLabels: Record<AppRole, string> = {
  read_only: "للقراءة فقط",
  inventory_operator: "مشغل المخزون",
  administrator: "مدير النظام",
};

const dateFormatter = new Intl.DateTimeFormat("ar-DZ", {
  dateStyle: "medium",
  timeZone: "Africa/Algiers",
});

export function UserManagement({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: ManagedUserView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setCreateError("");
    setCreateSuccess("");
    startTransition(async () => {
      try {
        const result = await createManagedUser(formData);
        if (!result.ok) {
          setCreateError(result.error ?? "تعذّر إنشاء الحساب.");
          return;
        }
        form.reset();
        setCreateSuccess("تم إنشاء الحساب بنجاح.");
        router.refresh();
      } catch {
        setCreateError("تعذّر الاتصال بالخادم. حاول مرة أخرى.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/[0.07] bg-slate-900/75 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
            <UserRoundPlus aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">إنشاء حساب</h3>
            <p className="mt-1 text-xs text-slate-400">
              الحسابات الجديدة لا تملك صلاحية التسجيل العام.
            </p>
          </div>
        </div>
        <form
          onSubmit={handleCreate}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          <div className="space-y-2">
            <Label htmlFor="managed-user-name">الاسم</Label>
            <Input
              id="managed-user-name"
              name="name"
              autoComplete="name"
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managed-user-email">البريد الإلكتروني</Label>
            <Input
              id="managed-user-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              dir="ltr"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managed-user-password">كلمة مرور أولية</Label>
            <Input
              id="managed-user-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managed-user-role">الدور</Label>
            <select
              id="managed-user-role"
              name="role"
              defaultValue="read_only"
              className="h-10 w-full rounded-lg border border-white/[0.1] bg-slate-950 px-3 text-sm text-slate-100 outline-none focus-visible:border-sky-400/50 focus-visible:ring-2 focus-visible:ring-sky-400/20"
            >
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isPending} className="h-10 w-full">
              {isPending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </div>
        </form>
        {createError && (
          <p role="alert" className="mt-4 text-sm text-rose-300">
            {createError}
          </p>
        )}
        {createSuccess && (
          <p role="status" className="mt-4 text-sm text-emerald-300">
            {createSuccess}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/75">
        <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <h3 className="font-semibold text-white">الحسابات المسجلة</h3>
          <p className="mt-1 text-xs text-slate-400">
            لا يمكن تغيير دور حسابك أو تعطيله من هذه الصفحة.
          </p>
        </div>
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>المستخدم</TableHead>
              <TableHead>الدور</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>تاريخ الإنشاء</TableHead>
              <TableHead>إدارة الوصول</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <ManagedUserRow
                key={user.id}
                user={user}
                isCurrentUser={user.id === currentUserId}
                onUpdated={() => router.refresh()}
              />
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-400">
                  لا توجد حسابات لعرضها.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function ManagedUserRow({
  user,
  isCurrentUser,
  onUpdated,
}: {
  user: ManagedUserView;
  isCurrentUser: boolean;
  onUpdated: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function changeRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await changeManagedUserRole(formData);
        if (!result.ok) {
          setError(result.error ?? "تعذّر تغيير دور المستخدم.");
          return;
        }
        setSuccess("تم تحديث الدور.");
        onUpdated();
      } catch {
        setError("تعذّر الاتصال بالخادم. حاول مرة أخرى.");
      }
    });
  }

  function disableUser() {
    if (!window.confirm(`هل تريد تعطيل حساب «${user.name}»؟`)) return;
    const formData = new FormData();
    formData.set("userId", user.id);
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await disableManagedUser(formData);
        if (!result.ok) {
          setError(result.error ?? "تعذّر تعطيل الحساب.");
          return;
        }
        setSuccess("تم تعطيل الحساب.");
        onUpdated();
      } catch {
        setError("تعذّر الاتصال بالخادم. حاول مرة أخرى.");
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-slate-100">
          {user.name}
          {isCurrentUser ? (
            <span className="ms-2 text-xs text-sky-300">(حسابك)</span>
          ) : null}
        </p>
        <p dir="ltr" className="mt-1 text-start text-xs text-slate-400">
          {user.email}
        </p>
      </TableCell>
      <TableCell>{user.role ? roleLabels[user.role] : "دور غير معروف"}</TableCell>
      <TableCell>
        <span
          className={
            user.disabled
              ? "text-xs text-rose-300"
              : "text-xs text-emerald-300"
          }
        >
          {user.disabled ? "معطل" : "نشط"}
        </span>
      </TableCell>
      <TableCell>{dateFormatter.format(new Date(user.createdAt))}</TableCell>
      <TableCell>
        {isCurrentUser ? (
          <span className="text-xs text-slate-500">لا يمكن إدارة حسابك</span>
        ) : (
          <div className="flex min-w-64 items-center gap-2">
            <form onSubmit={changeRole} className="flex items-center gap-2">
              <input type="hidden" name="userId" value={user.id} />
              <label className="sr-only" htmlFor={`role-${user.id}`}>
                دور {user.name}
              </label>
              <select
                id={`role-${user.id}`}
                name="role"
                required
                defaultValue={user.role ?? ""}
                className="h-9 min-w-36 rounded-lg border border-white/[0.1] bg-slate-950 px-2 text-xs text-slate-100 outline-none focus-visible:border-sky-400/50"
              >
                {!user.role && (
                  <option value="" disabled>
                    دور غير معروف
                  </option>
                )}
                {APP_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline" disabled={isPending}>
                حفظ
              </Button>
            </form>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || user.disabled}
              onClick={disableUser}
            >
              {user.disabled ? "معطل" : "تعطيل"}
            </Button>
          </div>
        )}
        {(error || success) && (
          <p
            role={error ? "alert" : "status"}
            className={`mt-2 text-xs ${error ? "text-rose-300" : "text-emerald-300"}`}
          >
            {error || success}
          </p>
        )}
      </TableCell>
    </TableRow>
  );
}
