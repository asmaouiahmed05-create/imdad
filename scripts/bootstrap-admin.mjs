import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

export class AdminBootstrapError extends Error {
  constructor(code) {
    super(code);
    this.name = "AdminBootstrapError";
    this.code = code;
  }
}

export function validateBootstrapEnvironment(env) {
  if (env.IMDAD_ALLOW_ADMIN_BOOTSTRAP !== "1") {
    throw new AdminBootstrapError("bootstrap_not_enabled");
  }

  if (!env.IMDAD_ADMIN_EMAIL || !env.IMDAD_ADMIN_EMAIL.includes("@")) {
    throw new AdminBootstrapError("invalid_admin_email");
  }

  if (!env.IMDAD_ADMIN_PASSWORD || env.IMDAD_ADMIN_PASSWORD.length < 12) {
    throw new AdminBootstrapError("admin_password_too_short");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(env.DATABASE_URL);
  } catch {
    throw new AdminBootstrapError("invalid_database_url");
  }

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    !databaseUrl.hostname.endsWith(".neon.tech")
  ) {
    throw new AdminBootstrapError("database_must_be_neon_postgresql");
  }

  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new AdminBootstrapError("better_auth_secret_missing_or_too_short");
  }

  try {
    const authUrl = new URL(env.BETTER_AUTH_URL);
    if (!["http:", "https:"].includes(authUrl.protocol)) {
      throw new Error();
    }
  } catch {
    throw new AdminBootstrapError("invalid_better_auth_url");
  }

  return {
    email: env.IMDAD_ADMIN_EMAIL,
    name: env.IMDAD_ADMIN_NAME?.trim() || "Administrator",
    password: env.IMDAD_ADMIN_PASSWORD,
  };
}

async function bootstrapAdmin() {
  const inheritedDatabaseUrl = process.env.DATABASE_URL;
  const bootstrapInputs = {
    IMDAD_ALLOW_ADMIN_BOOTSTRAP: process.env.IMDAD_ALLOW_ADMIN_BOOTSTRAP,
    IMDAD_ADMIN_EMAIL: process.env.IMDAD_ADMIN_EMAIL,
    IMDAD_ADMIN_NAME: process.env.IMDAD_ADMIN_NAME,
    IMDAD_ADMIN_PASSWORD: process.env.IMDAD_ADMIN_PASSWORD,
  };

  if (!inheritedDatabaseUrl) {
    throw new AdminBootstrapError("database_url_must_come_from_process_environment");
  }

  if (
    !bootstrapInputs.IMDAD_ALLOW_ADMIN_BOOTSTRAP ||
    !bootstrapInputs.IMDAD_ADMIN_EMAIL ||
    !bootstrapInputs.IMDAD_ADMIN_PASSWORD
  ) {
    throw new AdminBootstrapError("bootstrap_inputs_must_come_from_process_environment");
  }

  loadEnvConfig(
    process.cwd(),
    process.env.NODE_ENV !== "production",
    { info() {}, error() {} },
  );

  if (process.env.DATABASE_URL !== inheritedDatabaseUrl) {
    throw new AdminBootstrapError("database_url_changed_during_environment_loading");
  }

  const account = validateBootstrapEnvironment({
    ...process.env,
    ...bootstrapInputs,
    DATABASE_URL: inheritedDatabaseUrl,
  });

  const [{ betterAuth }, { prismaAdapter }, { prisma }, { createAuthOptions }] =
    await Promise.all([
      import("better-auth"),
      import("@better-auth/prisma-adapter"),
      import("../src/lib/db.ts"),
      import("../src/lib/auth-config.ts"),
    ]);

  const auth = betterAuth(
    createAuthOptions(
      prismaAdapter(prisma, {
        provider: "postgresql",
      }),
    ),
  );

  try {
    await prisma.$transaction(async (tx) => {
      const lock = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(1229802561, 1112759120) AS acquired`;
      if (!lock[0]?.acquired) {
        throw new AdminBootstrapError("another_admin_bootstrap_is_running");
      }

      const identity = await tx.$queryRaw`SELECT current_database() AS database_name, current_schema() AS schema_name, current_setting($$transaction_read_only$$) AS read_only`;
      if (
        identity[0]?.schema_name !== "public" ||
        identity[0]?.read_only !== "off"
      ) {
        throw new AdminBootstrapError("database_identity_or_write_access_invalid");
      }

      if ((await tx.user.count()) !== 0) {
        throw new AdminBootstrapError("bootstrap_requires_an_empty_user_table");
      }

      const result = await auth.api.createUser({
        body: {
          name: account.name,
          email: account.email,
          password: account.password,
          role: "administrator",
        },
      });

      const created = await tx.user.findUnique({
        where: { id: result.user.id },
        select: { id: true, role: true },
      });
      if (!created || created.role !== "administrator") {
        throw new AdminBootstrapError("administrator_persistence_verification_failed");
      }
    });

    console.log("The first administrator account was created and verified.");
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  bootstrapAdmin().catch((error) => {
    const code =
      typeof error?.code === "string"
        ? error.code
        : typeof error?.name === "string"
          ? error.name
          : "unknown_error";
    console.error(`Administrator bootstrap failed (${code}).`);
    process.exitCode = 1;
  });
}
