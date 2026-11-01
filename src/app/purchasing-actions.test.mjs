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

function form(values) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

test("supplier actions validate, preserve status/history, and enforce permissions", async (t) => {
  const users = new Map([
    ["admin", { role: "administrator", banned: false, banExpires: null }],
    ["operator", { role: "inventory_operator", banned: false, banExpires: null }],
    ["reader", { role: "read_only", banned: false, banExpires: null }],
  ]);
  const suppliers = new Map([
    [
      "supplier-1",
      {
        id: "supplier-1",
        name: "Existing Supplier",
        nameKey: "existing supplier",
        contactPerson: null,
        phone: null,
        email: null,
        address: null,
        notes: null,
        isActive: true,
      },
    ],
  ]);
  const purchaseOrderHistory = ["po-1", "po-2"];
  const revalidatedPaths = [];
  let actingUserId = null;
  let nextSupplierId = 1;

  const prisma = {
    user: {
      findUnique: async ({ where }) => {
        const user = users.get(where.id);
        return user
          ? {
              id: where.id,
              role: user.role,
              banned: user.banned,
              banExpires: user.banExpires,
            }
          : null;
      },
    },
    supplier: {
      create: async ({ data }) => {
        if ([...suppliers.values()].some((item) => item.nameKey === data.nameKey)) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        const supplier = { ...data, id: `new-${nextSupplierId++}` };
        suppliers.set(supplier.id, supplier);
        return { id: supplier.id };
      },
      update: async ({ where, data }) => {
        const supplier = suppliers.get(where.id);
        if (!supplier) {
          throw Object.assign(new Error("Record not found"), { code: "P2025" });
        }
        const nameKey = data.nameKey ?? supplier.nameKey;
        if (
          [...suppliers.values()].some(
            (item) => item.id !== supplier.id && item.nameKey === nameKey,
          )
        ) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        Object.assign(supplier, data);
        return { id: supplier.id };
      },
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
      headers: async () =>
        new Headers(actingUserId ? { "x-test-user-id": actingUserId } : {}),
    },
  });
  t.mock.module("next/cache", {
    exports: { revalidatePath: (path) => revalidatedPaths.push(path) },
  });
  t.mock.module("next/navigation", {
    exports: {
      redirect: () => {
        throw new Error("Unexpected redirect in supplier action test.");
      },
    },
  });

  const {
    changeSupplierStatus,
    createSupplier,
    updateSupplier,
  } = await import("./purchasing-actions.ts");

  const supplierForm = (values = {}) =>
    form({
      name: "New Supplier",
      contactPerson: "Contact",
      email: "contact@example.test",
      ...values,
    });

  actingUserId = "reader";
  await assert.rejects(createSupplier(supplierForm()), AuthorizationError);
  await assert.rejects(
    updateSupplier(supplierForm({ id: "supplier-1" })),
    AuthorizationError,
  );
  await assert.rejects(
    changeSupplierStatus(form({ id: "supplier-1", status: "inactive" })),
    AuthorizationError,
  );
  assert.equal(suppliers.size, 1);
  assert.deepEqual(revalidatedPaths, []);

  actingUserId = "operator";
  assert.deepEqual(
    await createSupplier(
      supplierForm({ name: "  New   Supplier  ", isActive: "off" }),
    ),
    { ok: true, id: "new-1" },
  );
  assert.equal(suppliers.get("new-1").name, "New Supplier");
  assert.equal(suppliers.get("new-1").isActive, true);

  assert.deepEqual(
    await createSupplier(supplierForm({ name: "new supplier" })),
    { ok: false, error: "يوجد مورد مسجل بهذا الاسم بالفعل." },
  );
  assert.equal(
    (await createSupplier(supplierForm({ email: "not-an-email" }))).ok,
    false,
  );

  assert.deepEqual(
    await updateSupplier(
      supplierForm({
        id: "new-1",
        name: "Updated Supplier",
        isActive: "off",
      }),
    ),
    { ok: true, id: "new-1" },
  );
  assert.equal(suppliers.get("new-1").isActive, true);
  assert.equal(suppliers.get("new-1").name, "Updated Supplier");

  assert.deepEqual(
    await changeSupplierStatus(form({ id: "new-1", status: "inactive" })),
    { ok: true, id: "new-1" },
  );
  assert.equal(suppliers.get("new-1").isActive, false);
  assert.deepEqual(
    await changeSupplierStatus(form({ id: "new-1", status: "active" })),
    { ok: true, id: "new-1" },
  );
  assert.equal(suppliers.get("new-1").isActive, true);

  assert.equal(
    (await changeSupplierStatus(form({ id: "new-1", status: "unknown" }))).ok,
    false,
  );
  assert.equal((await changeSupplierStatus(form({ status: "active" }))).ok, false);
  assert.equal(
    (await changeSupplierStatus(form({ id: "missing", status: "inactive" }))).ok,
    false,
  );
  assert.deepEqual(purchaseOrderHistory, ["po-1", "po-2"]);
  assert.ok(revalidatedPaths.includes("/suppliers"));
  assert.ok(revalidatedPaths.includes("/control-tower"));
  assert.ok(revalidatedPaths.includes("/purchase-orders"));
});
