export const APP_ROLES = [
  "read_only",
  "inventory_operator",
  "administrator",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  "inventory.read",
  "product.create",
  "product.update",
  "product.delete",
  "stock.move",
  "supplier.read",
  "supplier.manage",
  "purchase_order.read",
  "purchase_order.create",
  "purchase_order.edit_draft",
  "purchase_order.submit",
  "purchase_order.receive",
  "purchase_order.cancel",
  "reports.read",
  "reports.export",
  "users.manage",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

const READ_ONLY_PERMISSIONS = [
  "inventory.read",
  "supplier.read",
  "purchase_order.read",
  "reports.read",
] as const satisfies readonly AppPermission[];

const INVENTORY_OPERATOR_PERMISSIONS = [
  ...READ_ONLY_PERMISSIONS,
  "product.create",
  "product.update",
  "stock.move",
  "supplier.manage",
  "purchase_order.create",
  "purchase_order.edit_draft",
  "purchase_order.submit",
  "purchase_order.receive",
  "reports.export",
] as const satisfies readonly AppPermission[];

const ADMINISTRATOR_PERMISSIONS = APP_PERMISSIONS;

const PERMISSIONS_BY_ROLE: Record<AppRole, readonly AppPermission[]> = {
  read_only: READ_ONLY_PERMISSIONS,
  inventory_operator: INVENTORY_OPERATOR_PERMISSIONS,
  administrator: ADMINISTRATOR_PERMISSIONS,
};

export class AuthorizationError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "AuthorizationError";
  }
}

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    (APP_ROLES as readonly string[]).includes(value)
  );
}

export function isAccountDisabled(
  user: { banned: boolean | null; banExpires: Date | null },
  now = Date.now(),
) {
  if (user.banned === false) return false;
  if (user.banned === null) return true;
  return (
    user.banExpires === null || user.banExpires.getTime() > now
  );
}

export function reportExportDenialStatus(role: unknown): 401 | 403 | null {
  if (!isAppRole(role)) return 401;
  return hasPermission(role, "reports.export") ? null : 403;
}

export function hasPermission(
  role: unknown,
  permission: AppPermission,
): role is AppRole {
  return (
    isAppRole(role) && PERMISSIONS_BY_ROLE[role].includes(permission)
  );
}

export function requirePermission(
  role: unknown,
  permission: AppPermission,
): asserts role is AppRole {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError();
  }
}
