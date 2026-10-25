import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after, before } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { PrismaClient } from "@prisma/client";
import { createAuthOptions } from "../../src/lib/auth-config.ts";
import { assertDisposablePostgresTarget } from "../../scripts/disposable-postgres.mjs";

const databaseUrl = process.env.IMDAD_TEST_DATABASE_URL;
assertDisposablePostgresTarget(
  databaseUrl,
  process.env.IMDAD_ALLOW_DISPOSABLE_DATABASE,
);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const fixtureEmails = new Set();
const auth = betterAuth({
  ...createAuthOptions(
    prismaAdapter(prisma, {
      provider: "postgresql",
    }),
  ),
  secret: randomBytes(32).toString("base64url"),
  baseURL: "http://localhost/api/auth",
});

async function post(path, body, cookie) {
  return auth.handler(
    new Request(`http://localhost/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function cookieFrom(response) {
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.ok(cookie, "expected an authentication session cookie");
  return cookie;
}

async function signIn(email, password) {
  const response = await post("/sign-in/email", { email, password });
  assert.equal(response.status, 200);
  return cookieFrom(response);
}

async function createFixtureUser(email, role, password) {
  fixtureEmails.add(email);
  const result = await auth.api.createUser({
    body: {
      name: role,
      email,
      password,
      role,
    },
  });
  return result.user;
}

before(async () => {
  await prisma.$connect();
});

after(async () => {
  try {
    if (fixtureEmails.size > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: [...fixtureEmails] } },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
});

test("PostgreSQL-backed authentication and authorization flows", async () => {
  const password = randomBytes(18).toString("base64url");
  const suffix = randomBytes(8).toString("hex");
  const adminEmail = `admin-${suffix}@example.test`;
  const operatorEmail = `operator-${suffix}@example.test`;
  const readOnlyEmail = `readonly-${suffix}@example.test`;
  const expiredEmail = `expired-${suffix}@example.test`;

  await createFixtureUser(adminEmail, "administrator", password);
  const operator = await createFixtureUser(
    operatorEmail,
    "inventory_operator",
    password,
  );
  const readOnly = await createFixtureUser(
    readOnlyEmail,
    "read_only",
    password,
  );
  const expiredUser = await createFixtureUser(
    expiredEmail,
    "read_only",
    password,
  );

  const adminCookie = await signIn(adminEmail, password);
  const operatorCookie = await signIn(operatorEmail, password);
  const readOnlyCookie = await signIn(readOnlyEmail, password);
  const expiredCookie = await signIn(expiredEmail, password);

  const signup = await post("/sign-up/email", {
    name: "Public signup",
    email: `signup-${suffix}@example.test`,
    password,
  });
  assert.notEqual(signup.status, 200);

  for (const [role, cookie] of [
    ["read_only", readOnlyCookie],
    ["inventory_operator", operatorCookie],
    ["administrator", adminCookie],
  ]) {
    const impersonate = await post(
      "/admin/impersonate-user",
      { userId: readOnly.id },
      cookie,
    );
    assert.equal(impersonate.status, 403, `${role} impersonation must be denied`);

    const stop = await post("/admin/stop-impersonating", {}, cookie);
    assert.equal(stop.status, 404, `${role} stop-impersonation must be disabled`);
  }

  const provisioningDenied = await post(
    "/admin/create-user",
    {
      name: "Denied",
      email: `denied-${suffix}@example.test`,
      password,
      role: "read_only",
    },
    readOnlyCookie,
  );
  assert.equal(provisioningDenied.status, 403);

  const provisionedEmail = `provisioned-${suffix}@example.test`;
  fixtureEmails.add(provisionedEmail);
  const provisioned = await post(
    "/admin/create-user",
    {
      name: "Provisioned",
      email: provisionedEmail,
      password,
      role: "read_only",
    },
    adminCookie,
  );
  assert.equal(provisioned.status, 200);

  const roleChange = await post(
    "/admin/set-role",
    { userId: operator.id, role: "read_only" },
    adminCookie,
  );
  assert.equal(roleChange.status, 200);
  const updatedRoleSession = await auth.api.getSession({
    headers: new Headers({ cookie: operatorCookie }),
  });
  assert.equal(updatedRoleSession?.user.role, "read_only");

  const expiredSession = await prisma.session.updateMany({
    where: { userId: expiredUser.id },
    data: { expiresAt: new Date(0) },
  });
  assert.equal(expiredSession.count, 1);
  assert.equal(
    await auth.api.getSession({
      headers: new Headers({ cookie: expiredCookie }),
    }),
    null,
  );

  const banned = await post(
    "/admin/ban-user",
    { userId: readOnly.id, banReason: "integration test disabled user" },
    adminCookie,
  );
  assert.equal(banned.status, 200);
  assert.equal(
    await auth.api.getSession({
      headers: new Headers({ cookie: readOnlyCookie }),
    }),
    null,
  );

  const signedOut = await post("/sign-out", {}, adminCookie);
  assert.equal(signedOut.status, 200);
  assert.equal(
    await auth.api.getSession({
      headers: new Headers({ cookie: adminCookie }),
    }),
    null,
  );
});
