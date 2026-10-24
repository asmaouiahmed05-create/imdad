"use server";

import { headers } from "next/headers";
import { isAppRole } from "@/lib/authorization";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authz";

type UserActionResult = { ok: boolean; error?: string };

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createManagedUser(
  formData: FormData,
): Promise<UserActionResult> {
  await requirePermission("users.manage");

  const name = field(formData, "name");
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = field(formData, "role");
  if (!name || name.length > 120) {
    return { ok: false, error: "أدخل اسمًا صالحًا للمستخدم." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return { ok: false, error: "أدخل بريدًا إلكترونيًا صالحًا." };
  }
  if (password.length < 12 || password.length > 128) {
    return { ok: false, error: "يجب أن تتراوح كلمة المرور بين 12 و128 حرفًا." };
  }
  if (!isAppRole(role)) {
    return { ok: false, error: "دور المستخدم غير صالح." };
  }

  try {
    await auth.api.createUser({
      body: { name, email, password, role },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "تعذّر إنشاء الحساب." };
  }
}

export async function changeManagedUserRole(
  formData: FormData,
): Promise<UserActionResult> {
  await requirePermission("users.manage");

  const userId = field(formData, "userId");
  const role = field(formData, "role");
  if (!userId || !isAppRole(role)) {
    return { ok: false, error: "بيانات المستخدم أو دوره غير صالحة." };
  }

  try {
    await auth.api.setRole({
      body: { userId, role },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "تعذّر تغيير دور المستخدم." };
  }
}

export async function disableManagedUser(
  formData: FormData,
): Promise<UserActionResult> {
  await requirePermission("users.manage");

  const userId = field(formData, "userId");
  if (!userId) return { ok: false, error: "المستخدم غير محدد." };

  try {
    await auth.api.banUser({
      body: { userId, banReason: "Account disabled by an administrator" },
      headers: await headers(),
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "تعذّر تعطيل الحساب." };
  }
}
