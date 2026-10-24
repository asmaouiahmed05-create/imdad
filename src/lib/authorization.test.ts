import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_PERMISSIONS,
  AuthorizationError,
  hasPermission,
  isAccountDisabled,
  isAppRole,
  reportExportDenialStatus,
  requirePermission,
} from "./authorization.ts";
import { authorizeReportExportRequest } from "./report-export-auth.ts";
import { resolveAuthenticatedPrincipal } from "./authz-core.ts";

test("read-only users have only view and report-reading permissions", () => {
  for (const permission of APP_PERMISSIONS) {
    assert.equal(
      hasPermission("read_only", permission),
      [
        "inventory.read",
        "supplier.read",
        "purchase_order.read",
        "reports.read",
      ].includes(permission),
      permission,
    );
  }
});

test("inventory operators can operate inventory and export but cannot administer", () => {
  assert.equal(hasPermission("inventory_operator", "product.create"), true);
  assert.equal(hasPermission("inventory_operator", "product.update"), true);
  assert.equal(hasPermission("inventory_operator", "stock.move"), true);
  assert.equal(hasPermission("inventory_operator", "supplier.manage"), true);
  assert.equal(hasPermission("inventory_operator", "purchase_order.receive"), true);
  assert.equal(hasPermission("inventory_operator", "reports.export"), true);
  assert.equal(hasPermission("inventory_operator", "product.delete"), false);
  assert.equal(hasPermission("inventory_operator", "purchase_order.cancel"), false);
  assert.equal(hasPermission("inventory_operator", "users.manage"), false);
});

test("administrators have every declared permission", () => {
  for (const permission of APP_PERMISSIONS) {
    assert.equal(hasPermission("administrator", permission), true, permission);
  }
});

test("untrusted or unknown roles fail closed", () => {
  for (const role of [null, undefined, "admin", "read_only ", 1, {}]) {
    assert.equal(isAppRole(role), false);
    assert.equal(hasPermission(role, "reports.export"), false);
    assert.throws(
      () => requirePermission(role, "reports.export"),
      AuthorizationError,
    );
  }
});

test("permission guard allows authorized roles and rejects forbidden roles", () => {
  assert.doesNotThrow(() =>
    requirePermission("inventory_operator", "reports.export"),
  );
  assert.throws(
    () => requirePermission("read_only", "reports.export"),
    AuthorizationError,
  );
});

test("disabled accounts are rejected unless a temporary ban has expired", () => {
  const now = Date.now();
  assert.equal(isAccountDisabled({ banned: true, banExpires: null }, now), true);
  assert.equal(
    isAccountDisabled({ banned: true, banExpires: new Date(now + 1_000) }, now),
    true,
  );
  assert.equal(
    isAccountDisabled({ banned: true, banExpires: new Date(now - 1_000) }, now),
    false,
  );
  assert.equal(isAccountDisabled({ banned: false, banExpires: null }, now), false);
  assert.equal(isAccountDisabled({ banned: null, banExpires: null }, now), true);
});

test("report export entry-point decision denies anonymous and read-only users", () => {
  assert.equal(reportExportDenialStatus(null), 401);
  assert.equal(reportExportDenialStatus("unknown"), 401);
  assert.equal(reportExportDenialStatus("read_only"), 403);
  assert.equal(reportExportDenialStatus("inventory_operator"), null);
  assert.equal(reportExportDenialStatus("administrator"), null);
});

test("report export request gate authorizes only operators and administrators", async () => {
  for (const [role, expectedStatus] of [
    [null, 401],
    ["read_only", 403],
    ["inventory_operator", null],
    ["administrator", null],
  ] as const) {
    const denial = await authorizeReportExportRequest(async () =>
      role === null ? null : { role },
    );
    assert.equal(denial?.status ?? null, expectedStatus, String(role));
  }
});

test("server principal resolution rejects anonymous, banned, and unknown-role users", async () => {
  let databaseReads = 0;
  const user = {
    id: "user-1",
    role: "inventory_operator",
    banned: false,
    banExpires: null,
  };

  const anonymous = await resolveAuthenticatedPrincipal(
    async () => null,
    async () => {
      databaseReads += 1;
      return user;
    },
  );
  assert.equal(anonymous, null);
  assert.equal(databaseReads, 0);

  const active = await resolveAuthenticatedPrincipal(
    async () => ({ user: { id: "session-user" } }),
    async (id) => {
      databaseReads += 1;
      assert.equal(id, "session-user");
      return user;
    },
  );
  assert.deepEqual(active, { id: "user-1", role: "inventory_operator" });

  const banned = await resolveAuthenticatedPrincipal(
    async () => ({ user: { id: "user-1" } }),
    async () => ({ ...user, banned: true }),
  );
  assert.equal(banned, null);

  const unknownRole = await resolveAuthenticatedPrincipal(
    async () => ({ user: { id: "user-1" } }),
    async () => ({ ...user, role: null }),
  );
  assert.equal(unknownRole, null);
});

test("server principal resolution observes role changes from the current user record", async () => {
  let currentRole: unknown = "read_only";
  const loadSession = async () => ({ user: { id: "user-1" } });
  const loadUser = async () => ({
    id: "user-1",
    role: currentRole,
    banned: false,
    banExpires: null,
  });

  assert.deepEqual(
    await resolveAuthenticatedPrincipal(loadSession, loadUser),
    { id: "user-1", role: "read_only" },
  );
  currentRole = "inventory_operator";
  assert.deepEqual(
    await resolveAuthenticatedPrincipal(loadSession, loadUser),
    { id: "user-1", role: "inventory_operator" },
  );
});
