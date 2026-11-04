import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { AuthorizationError } from "../../../lib/authorization.ts";

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
      specifier === "next/cache" ||
      specifier === "next/navigation"
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

test("production and BOM server actions deny users without manage permission", async (t) => {
  let transactionCalls = 0;
  const prisma = {
    user: {
      findUnique: async ({ where }) => ({
        id: where.id,
        role: "read_only",
        banned: false,
        banExpires: null,
      }),
    },
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error("Unauthorized action reached a transaction");
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
      headers: async () => new Headers({ "x-test-user-id": "reader" }),
    },
  });
  t.mock.module("next/cache", { exports: { revalidatePath: () => {} } });
  t.mock.module("next/navigation", {
    exports: { redirect: () => { throw new Error("Unexpected redirect"); } },
  });

  const productionActions = await import("./actions.ts");
  const bomActions = await import("../boms/actions.ts");
  const formData = new FormData();

  for (const action of [
    () => productionActions.createProductionOrder(formData),
    () => productionActions.updateProductionOrder(formData),
    () => productionActions.startProductionOrder("order-1"),
    () => productionActions.completeProductionOrder("order-1", "1"),
    () => productionActions.cancelProductionOrder("order-1"),
    () => bomActions.createBom(formData),
    () => bomActions.updateBom(formData),
    () => bomActions.transitionBom("bom-1", "release"),
  ]) {
    await assert.rejects(action(), AuthorizationError);
  }
  assert.equal(transactionCalls, 0);
});
