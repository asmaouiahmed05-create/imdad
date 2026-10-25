import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertDisposablePostgresTarget,
  assertLocalPostgresIdentity,
} from "./disposable-postgres.mjs";

const allow = "1";
const disposableUrl =
  "postgresql://imdad_test:secret@localhost:55432/imdad_integration_test";

test("accepts only the explicitly opted-in dedicated local test target", () => {
  assert.doesNotThrow(() =>
    assertDisposablePostgresTarget(disposableUrl, allow),
  );
});

test("rejects an absent explicit opt-in", () => {
  assert.throws(
    () =>
      assertDisposablePostgresTarget(
        disposableUrl,
        undefined,
      ),
    /IMDAD_ALLOW_DISPOSABLE_DATABASE/,
  );
});

test("rejects remote hosts", () => {
  assert.throws(
    () =>
      assertDisposablePostgresTarget(
        "postgresql://imdad_test:secret@db.example.test:5432/imdad_integration_test",
        allow,
      ),
    /loopback PostgreSQL/,
  );
});

test("rejects connection URI parameters that could override the loopback target", () => {
  for (const suffix of ["?host=db.example.test", "?hostaddr=203.0.113.1", "#fragment"]) {
    assert.throws(
      () =>
        assertDisposablePostgresTarget(
          `postgresql://imdad_test:secret@localhost:55432/imdad_integration_test${suffix}`,
          allow,
        ),
      /dedicated local test role/,
    );
  }
});

test("rejects database and role names without a test marker", () => {
  for (const url of [
    "postgresql://imdad_test:secret@localhost:55432/imdad",
    "postgresql://imdad:secret@localhost:55432/imdad_integration_test",
    "postgresql://imdad_test:secret@localhost:5432/imdad_integration_test",
  ]) {
    assert.throws(
      () => assertDisposablePostgresTarget(url, allow),
      /dedicated local test role/,
    );
  }
});

test("rejects non-PostgreSQL URLs without echoing credentials", () => {
  assert.throws(
    () =>
      assertDisposablePostgresTarget(
        "mysql://imdad_test:never-print-this@localhost:3306/imdad_test",
        allow,
      ),
    (error) => {
    assert.match(error.message, /dedicated local test role/);
      assert.doesNotMatch(error.message, /never-print-this/);
      return true;
    },
  );
});

test("accepts only matching identity served on a loopback PostgreSQL address", () => {
  assert.doesNotThrow(() =>
    assertLocalPostgresIdentity(
      {
        username: "imdad_test",
        database: "imdad_integration_test",
        serverAddress: "127.0.0.1",
      },
      "imdad_test",
      "imdad_integration_test",
    ),
  );
  assert.doesNotThrow(() =>
    assertLocalPostgresIdentity(
      {
        username: "imdad_test",
        database: "imdad_integration_test",
        serverAddress: "::1",
      },
      "imdad_test",
      "imdad_integration_test",
    ),
  );

  for (const serverAddress of ["203.0.113.5", "172.18.0.2", null]) {
    assert.throws(
      () =>
        assertLocalPostgresIdentity(
          {
            username: "imdad_test",
            database: "imdad_integration_test",
            serverAddress,
          },
          "imdad_test",
          "imdad_integration_test",
        ),
      /not the expected local test database/,
    );
  }
  assert.throws(
    () =>
      assertLocalPostgresIdentity(
        {
          username: "prod_admin",
          database: "imdad_integration_test",
          serverAddress: "127.0.0.1",
        },
        "imdad_test",
        "imdad_integration_test",
      ),
    /not the expected local test database/,
  );
});

test("auth migration is additive and creates the declared auth tables", async () => {
  const migration = await readFile(
    new URL(
      "../prisma/migrations/20261025145500_add_better_auth_tables/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.deepEqual(
    [...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map((match) => match[1]),
    ["user", "session", "account", "verification"],
  );
  assert.doesNotMatch(
    migration,
    /\b(?:DROP\s+(?:TABLE|SCHEMA|TYPE)|TRUNCATE\b|DELETE\s+FROM)\b/i,
  );
  assert.doesNotMatch(migration, /ALTER TABLE "(?!session|account)/);

  const schema = await readFile(
    new URL("../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  for (const [model, table] of [
    ["User", "user"],
    ["Session", "session"],
    ["Account", "account"],
    ["Verification", "verification"],
  ]) {
    const modelBlock = schema.match(
      new RegExp("^model " + model + " \\{([\\s\\S]*?)^\\}", "m"),
    )?.[1];
    const tableBlock = migration.match(
      new RegExp('CREATE TABLE "' + table + '" \\(([\\s\\S]*?)\\n\\);'),
    )?.[1];
    assert.ok(modelBlock, `missing Prisma model ${model}`);
    assert.ok(tableBlock, `missing migration table ${table}`);

    const modelFields = [
      ...modelBlock.matchAll(/^\s+(\w+)\s+(?:String|Boolean|DateTime)\??\s/mg),
    ].map((match) => match[1]);
    const migrationFields = [
      ...tableBlock.matchAll(/^\s+"(\w+)"\s+(?:TEXT|BOOLEAN|TIMESTAMP\(3\))/mg),
    ].map((match) => match[1]);
    assert.deepEqual(migrationFields, modelFields, `${table} fields do not match`);
  }
});
