import assert from "node:assert/strict";
import test from "node:test";
import {
  AdminBootstrapError,
  validateBootstrapEnvironment,
} from "./bootstrap-admin.mjs";

const validEnvironment = {
  DATABASE_URL:
    "postgresql://bootstrap:password@ep-example-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require",
  BETTER_AUTH_SECRET: "a".repeat(43),
  BETTER_AUTH_URL: "http://127.0.0.1:3000/",
  IMDAD_ALLOW_ADMIN_BOOTSTRAP: "1",
  IMDAD_ADMIN_EMAIL: "admin@example.test",
  IMDAD_ADMIN_PASSWORD: "safe-bootstrap-password",
};

function assertBootstrapError(env, code) {
  assert.throws(
    () => validateBootstrapEnvironment(env),
    (error) =>
      error instanceof AdminBootstrapError &&
      error.code === code &&
      !error.message.includes(validEnvironment.IMDAD_ADMIN_PASSWORD) &&
      !error.message.includes(validEnvironment.DATABASE_URL),
  );
}

test("requires explicit one-time bootstrap authorization", () => {
  assertBootstrapError(
    { ...validEnvironment, IMDAD_ALLOW_ADMIN_BOOTSTRAP: undefined },
    "bootstrap_not_enabled",
  );
});

test("rejects non-Neon and malformed PostgreSQL endpoints", () => {
  assertBootstrapError(
    { ...validEnvironment, DATABASE_URL: "postgresql://localhost/imdad" },
    "database_must_be_neon_postgresql",
  );
  assertBootstrapError(
    { ...validEnvironment, DATABASE_URL: "not-a-database-url" },
    "invalid_database_url",
  );
});

test("requires valid auth configuration and a sufficiently long password", () => {
  assertBootstrapError(
    { ...validEnvironment, IMDAD_ADMIN_PASSWORD: "short" },
    "admin_password_too_short",
  );
  assertBootstrapError(
    { ...validEnvironment, BETTER_AUTH_SECRET: "short" },
    "better_auth_secret_missing_or_too_short",
  );
  assertBootstrapError(
    { ...validEnvironment, BETTER_AUTH_URL: "file:///tmp/auth" },
    "invalid_better_auth_url",
  );
});

test("returns only validated account input and applies a safe default name", () => {
  const account = validateBootstrapEnvironment({
    ...validEnvironment,
    IMDAD_ADMIN_NAME: "  ",
  });

  assert.deepEqual(account, {
    email: "admin@example.test",
    name: "Administrator",
    password: "safe-bootstrap-password",
  });
});
