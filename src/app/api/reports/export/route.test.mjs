import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        pathToFileURL(resolve("src", `${specifier.slice(2)}.ts`)).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});

test("report export GET enforces authorization and validates request parameters", async (t) => {
  let principal = null;
  let productQueries = 0;
  const prisma = {
    product: {
      findMany: async () => {
        productQueries += 1;
        return [];
      },
    },
    stockMovement: {
      findMany: async () => {
        productQueries += 1;
        return [];
      },
    },
  };

  t.mock.module("@/lib/authz", {
    exports: {
      getAuthenticatedPrincipal: async () => principal,
    },
  });
  t.mock.module("@/lib/db", {
    exports: { prisma },
  });

  const { GET } = await import("./route.ts");
  const request = (query = "") =>
    new Request(`http://localhost/api/reports/export${query}`);

  const anonymous = await GET(request());
  assert.equal(anonymous.status, 401);
  assert.deepEqual(await anonymous.json(), {
    error: "Authentication required.",
  });

  principal = { role: "read_only" };
  const readOnly = await GET(request());
  assert.equal(readOnly.status, 403);
  assert.deepEqual(await readOnly.json(), { error: "Forbidden." });
  assert.equal(productQueries, 0);

  for (const role of ["inventory_operator", "administrator"]) {
    principal = { role };
    const response = await GET(request());
    assert.equal(response.status, 200, role);
    assert.match(
      response.headers.get("content-type") ?? "",
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/u,
    );
    await response.arrayBuffer();
  }
  assert.equal(productQueries, 2);

  principal = { role: "administrator" };
  const invalidReport = await GET(request("?report=unknown"));
  assert.equal(invalidReport.status, 400);
  assert.deepEqual(await invalidReport.json(), {
    error: "نوع التقرير غير صالح.",
  });

  const invalidDate = await GET(request("?from=2026-02-30"));
  assert.equal(invalidDate.status, 400);
  assert.deepEqual(await invalidDate.json(), {
    error: "أدخل تاريخًا صحيحًا للفترة المحددة.",
  });
  assert.equal(productQueries, 2);
});
