import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { AuthorizationError } from "../../lib/authorization.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        pathToFileURL(resolve("src", `${specifier.slice(2)}.ts`)).href,
        context,
      );
    }
    if (specifier === "next/headers" || specifier === "next/cache") {
      return nextResolve(
        pathToFileURL(
          resolve("node_modules/next", `${specifier.slice(5)}.js`),
        ).href,
        context,
      );
    }
    if (specifier === "next/navigation") {
      return nextResolve(
        pathToFileURL(resolve("node_modules/next/navigation.js")).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

test("sales server actions reject read-only users before any mutation", async (t) => {
  let actingUserId = "reader";
  let databaseMutations = 0;
  const users = new Map([
    ["reader", { role: "read_only", banned: false, banExpires: null }],
    [
      "operator",
      { role: "inventory_operator", banned: false, banExpires: null },
    ],
  ]);
  const prisma = {
    user: {
      findUnique: async ({ where }) => {
        const user = users.get(where.id);
        return user ? { id: where.id, ...user } : null;
      },
    },
    customer: {
      create: async () => {
        databaseMutations += 1;
        throw new Error("Unexpected customer mutation");
      },
      update: async () => {
        databaseMutations += 1;
        throw new Error("Unexpected customer mutation");
      },
    },
    customerOrder: {
      findUnique: async () => null,
    },
    $transaction: async () => {
      databaseMutations += 1;
      throw new Error("Unauthorized order operation reached the database");
    },
  };
  const auth = {
    api: {
      getSession: async ({ headers }) => {
        const id = headers.get("x-test-user-id");
        return id ? { user: { id } } : null;
      },
    },
  };

  t.mock.module("@/lib/auth", { exports: { auth } });
  t.mock.module("@/lib/db", { exports: { prisma } });
  t.mock.module("next/headers", {
    exports: {
      headers: async () => new Headers({ "x-test-user-id": actingUserId }),
    },
  });
  t.mock.module("next/cache", { exports: { revalidatePath: () => {} } });
  t.mock.module("next/navigation", {
    exports: {
      redirect: () => {
        throw new Error("Unexpected redirect in sales action test.");
      },
    },
  });

  const actions = await import("./actions.ts");
  const formData = new FormData();
  for (const action of [
    () => actions.createCustomer(formData),
    () => actions.updateCustomer(formData),
    () => actions.createCustomerOrder(formData),
    () => actions.updateCustomerOrder(formData),
    () => actions.confirmCustomerOrder("order-1"),
    () => actions.fulfillCustomerOrder("order-1"),
    () => actions.cancelCustomerOrder("order-1"),
  ]) {
    await assert.rejects(action(), AuthorizationError);
  }
  assert.equal(databaseMutations, 0);

  actingUserId = "operator";
  assert.equal((await actions.createCustomer(formData)).ok, false);
  assert.equal((await actions.createCustomerOrder(formData)).ok, false);
  assert.deepEqual(await actions.confirmCustomerOrder(""), {
    ok: false,
    error: "طلب العميل غير محدد.",
  });
  assert.equal(databaseMutations, 0);
});
