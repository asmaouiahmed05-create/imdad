import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { AuthorizationError } from "../lib/authorization.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        pathToFileURL(resolve("src", `${specifier.slice(2)}.ts`)).href,
        context,
      );
    }
    if (
      specifier === "next/headers" ||
      specifier === "next/navigation" ||
      specifier === "next/cache"
    ) {
      return nextResolve(
        pathToFileURL(
          resolve("node_modules/next", `${specifier.slice(5)}.js`),
        ).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

function form(values) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

test("managed-user Server Actions enforce administrator authorization and preserve business rules", async (t) => {
  const users = new Map([
    [
      "admin-1",
      {
        id: "admin-1",
        name: "Administrator",
        email: "admin@example.test",
        role: "administrator",
        banned: false,
        banExpires: null,
      },
    ],
    [
      "reader-1",
      {
        id: "reader-1",
        name: "Reader",
        email: "reader@example.test",
        role: "read_only",
        banned: false,
        banExpires: null,
      },
    ],
    [
      "operator-1",
      {
        id: "operator-1",
        name: "Operator",
        email: "operator@example.test",
        role: "inventory_operator",
        banned: false,
        banExpires: null,
      },
    ],
  ]);
  let actingUserId = null;
  let nextUserId = 1;
  const calls = [];
  const revalidatedPaths = [];

  const auth = {
    api: {
      getSession: async ({ headers }) => {
        const userId = headers.get("x-test-user-id");
        return userId ? { user: { id: userId } } : null;
      },
      createUser: async ({ body }) => {
        calls.push("createUser");
        const user = {
          id: `managed-${nextUserId++}`,
          name: body.name,
          email: body.email,
          role: body.role,
          banned: false,
          banExpires: null,
        };
        users.set(user.id, user);
        return { user };
      },
      setRole: async ({ body }) => {
        calls.push("setRole");
        const user = users.get(body.userId);
        assert.ok(user, "role-change target must exist");
        user.role = body.role;
        return { user };
      },
      banUser: async ({ body }) => {
        calls.push("banUser");
        const user = users.get(body.userId);
        assert.ok(user, "ban target must exist");
        user.banned = true;
        return { user };
      },
    },
  };
  const prisma = {
    user: {
      findUnique: async ({ where }) => {
        const user = users.get(where.id);
        return user
          ? {
              id: user.id,
              role: user.role,
              banned: user.banned,
              banExpires: user.banExpires,
            }
          : null;
      },
    },
  };

  t.mock.module("@/lib/auth", { exports: { auth } });
  t.mock.module("@/lib/db", { exports: { prisma } });
  t.mock.module("next/headers", {
    exports: {
      headers: async () =>
        new Headers(actingUserId ? { "x-test-user-id": actingUserId } : {}),
    },
  });
  t.mock.module("next/navigation", {
    exports: {
      redirect: () => {
        throw new Error("Unexpected redirect in managed-user action test.");
      },
    },
  });
  t.mock.module("next/cache", {
    exports: {
      revalidatePath: (path) => revalidatedPaths.push(path),
    },
  });

  const {
    changeManagedUserRole,
    createManagedUser,
    disableManagedUser,
  } = await import("./user-actions.ts");

  const createForm = () =>
    form({
      name: "Managed User",
      email: "new-user@example.test",
      password: "long-enough-password",
      role: "read_only",
    });
  const roleForm = () =>
    form({ userId: "operator-1", role: "administrator" });
  const banForm = () => form({ userId: "operator-1" });

  const originalUsers = structuredClone([...users.entries()]);
  const originalCalls = [...calls];
  for (const userId of ["reader-1", "operator-1"]) {
    actingUserId = userId;
    await assert.rejects(createManagedUser(createForm()), AuthorizationError);
    await assert.rejects(
      changeManagedUserRole(roleForm()),
      AuthorizationError,
    );
    await assert.rejects(disableManagedUser(banForm()), AuthorizationError);
    assert.deepEqual([...users.entries()], originalUsers, `${userId} user records`);
    assert.deepEqual(calls, originalCalls, `${userId} privileged API calls`);
  }

  actingUserId = "admin-1";
  const beforeSelfManagement = structuredClone([...users.entries()]);
  const callsBeforeSelfManagement = [...calls];
  assert.equal(
    (
      await changeManagedUserRole(
        form({ userId: "admin-1", role: "read_only" }),
      )
    ).ok,
    false,
  );
  assert.equal((await disableManagedUser(form({ userId: "admin-1" }))).ok, false);
  assert.deepEqual([...users.entries()], beforeSelfManagement);
  assert.deepEqual(calls, callsBeforeSelfManagement);

  const created = await createManagedUser(
    form({
      name: "  New User  ",
      email: "  NEW-USER@example.test ",
      password: "long-enough-password",
      role: "inventory_operator",
    }),
  );
  assert.deepEqual(created, { ok: true });
  assert.deepEqual(revalidatedPaths, ["/users"]);
  const managedUser = [...users.values()].find(
    (user) => user.email === "new-user@example.test",
  );
  assert.ok(managedUser);
  assert.equal(managedUser.name, "New User");
  assert.equal(managedUser.role, "inventory_operator");

  assert.deepEqual(await changeManagedUserRole(roleForm()), { ok: true });
  assert.equal(users.get("operator-1")?.role, "administrator");
  assert.deepEqual(revalidatedPaths, ["/users", "/users"]);

  assert.deepEqual(await disableManagedUser(banForm()), { ok: true });
  assert.equal(users.get("operator-1")?.banned, true);
  assert.deepEqual(revalidatedPaths, ["/users", "/users", "/users"]);

  const callsBeforeInvalidForms = [...calls];
  const revalidationsBeforeInvalidForms = [...revalidatedPaths];
  for (const invalid of [
    { name: "", email: "valid@example.test", password: "long-enough-password", role: "read_only" },
    { name: "Valid", email: "not-an-email", password: "long-enough-password", role: "read_only" },
    { name: "Valid", email: "valid@example.test", password: "short", role: "read_only" },
    { name: "Valid", email: "valid@example.test", password: "long-enough-password", role: "unknown" },
  ]) {
    assert.equal((await createManagedUser(form(invalid))).ok, false);
  }
  assert.equal(
    (await changeManagedUserRole(form({ userId: "operator-1", role: "unknown" })))
      .ok,
    false,
  );
  assert.equal((await disableManagedUser(form({ userId: "" }))).ok, false);
  assert.deepEqual(calls, callsBeforeInvalidForms);
  assert.deepEqual(revalidatedPaths, revalidationsBeforeInvalidForms);
});
