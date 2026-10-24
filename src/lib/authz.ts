import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AppPermission, AppRole } from "@/lib/authorization";
import {
  AuthorizationError,
  requirePermission as requireRolePermission,
} from "@/lib/authorization";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveAuthenticatedPrincipal } from "@/lib/authz-core";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export type AuthenticatedPrincipal = {
  id: string;
  role: AppRole;
};

export async function getAuthenticatedPrincipal(): Promise<AuthenticatedPrincipal | null> {
  return resolveAuthenticatedPrincipal(
    async () => auth.api.getSession({ headers: await headers() }),
    (userId) =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          banned: true,
          banExpires: true,
        },
      }),
  );
}

export async function requirePermission(
  permission: AppPermission,
): Promise<AuthenticatedPrincipal> {
  const principal = await getAuthenticatedPrincipal();
  if (!principal) throw new AuthenticationRequiredError();
  requireRolePermission(principal.role, permission);
  return principal;
}

export async function requirePagePermission(
  permission: AppPermission,
): Promise<AuthenticatedPrincipal> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login");
    if (error instanceof AuthorizationError) redirect("/forbidden");
    throw error;
  }
}
