import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { pathToFileURL } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const TEST_DATABASE = "imdad_integration_test";
const TEST_USERNAME = "imdad_test";
const TEST_PORT = 55432;

export function assertDisposablePostgresTarget(connectionString, allowFlag) {
  if (allowFlag !== "1") {
    throw new Error("Set IMDAD_ALLOW_DISPOSABLE_DATABASE=1 to run integration tests.");
  }
  if (typeof connectionString !== "string" || connectionString.length === 0) {
    throw new Error("Set IMDAD_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("IMDAD_TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  let username;
  let database;
  try {
    username = decodeURIComponent(url.username);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error("IMDAD_TEST_DATABASE_URL contains invalid URL encoding.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !LOCAL_HOSTS.has(url.hostname.toLowerCase()) ||
    username !== TEST_USERNAME ||
    database !== TEST_DATABASE ||
    url.port !== String(TEST_PORT) ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      "Integration tests require the dedicated local test role, database, port, and a plain loopback PostgreSQL URL.",
    );
  }
}

export function assertLocalPostgresIdentity(identity) {
  if (
    !identity ||
    Object.keys(identity).length !== 4 ||
    identity.database !== TEST_DATABASE ||
    identity.username !== TEST_USERNAME ||
    identity.serverAddress !== "127.0.0.1" ||
    identity.serverPort !== TEST_PORT
  ) {
    throw new Error(
      "Connected PostgreSQL identity is not the expected local test database.",
    );
  }
}

function run(command, args, env) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) {
    throw new Error("Could not start the PostgreSQL integration command.");
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }
  return true;
}

async function main() {
  const connectionString = process.env.IMDAD_TEST_DATABASE_URL;
  assertDisposablePostgresTarget(
    connectionString,
    process.env.IMDAD_ALLOW_DISPOSABLE_DATABASE,
  );

  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT current_database() AS database, current_user AS username, host(inet_server_addr()) AS \"serverAddress\", inet_server_port() AS \"serverPort\"",
    );
    if (result.rows.length !== 1) {
      throw new Error("Connected PostgreSQL identity query returned an ambiguous result.");
    }
    assertLocalPostgresIdentity(result.rows[0]);
  } finally {
    await client.end();
  }

  if (process.argv.includes("--validate-only")) {
    console.log("Disposable PostgreSQL identity validated.");
    return;
  }

  const env = { ...process.env, DATABASE_URL: connectionString };
  if (
    !run(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "generate",
        "--config",
        "prisma.config.ts",
      ],
      env,
    )
  ) {
    return;
  }
  if (
    !run(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "deploy",
        "--config",
        "prisma.config.ts",
      ],
      env,
    )
  ) {
    return;
  }
  run(
    process.execPath,
    [
      "--experimental-strip-types",
      "--test",
      "tests/postgres/auth.integration.test.mjs",
    ],
    env,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Disposable PostgreSQL integration setup failed.");
    process.exitCode = 1;
  });
}
