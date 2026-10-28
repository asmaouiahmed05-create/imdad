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
  const operatorEmail = `operator-${suffix}@example.test`;
  const readOnlyEmail = `readonly-${suffix}@example.test`;
  const expiredEmail = `expired-${suffix}@example.test`;
  const administratorEmail = `administrator-${suffix}@example.test`;

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
  await createFixtureUser(administratorEmail, "administrator", password);

  const operatorCookie = await signIn(operatorEmail, password);
  const readOnlyCookie = await signIn(readOnlyEmail, password);
  const expiredCookie = await signIn(expiredEmail, password);
  const administratorCookie = await signIn(administratorEmail, password);

  const invalidCredentials = await post("/sign-in/email", {
    email: operatorEmail,
    password: `${password}-incorrect`,
  });
  assert.notEqual(invalidCredentials.status, 200);
  assert.deepEqual(invalidCredentials.headers.getSetCookie(), []);
  assert.equal(
    (await auth.api.getSession({
      headers: new Headers({ cookie: operatorCookie }),
    }))?.user.id,
    operator.id,
    "a successful sign-in must persist through a subsequent session lookup",
  );

  const signup = await post("/sign-up/email", {
    name: "Public signup",
    email: `signup-${suffix}@example.test`,
    password,
  });
  assert.notEqual(signup.status, 200);

  for (const [role, cookie, target] of [
    ["read_only", readOnlyCookie, operator],
    ["inventory_operator", operatorCookie, readOnly],
  ]) {
    const impersonate = await post(
      "/admin/impersonate-user",
      { userId: target.id },
      cookie,
    );
    assert.equal(impersonate.status, 403, `${role} impersonation must be denied`);

    const stop = await post("/admin/stop-impersonating", {}, cookie);
    assert.equal(stop.status, 404, `${role} stop-impersonation must be disabled`);
  }

  for (const [role, cookie, target] of [
    ["read_only", readOnlyCookie, operator],
    ["inventory_operator", operatorCookie, readOnly],
  ]) {
    const deniedEmail = `denied-${role}-${suffix}@example.test`;
    const createUser = await post(
      "/admin/create-user",
      { name: "Denied", email: deniedEmail, password, role: "read_only" },
      cookie,
    );
    assert.equal(createUser.status, 403, `${role} user creation must be denied`);
    assert.equal(
      await prisma.user.findUnique({ where: { email: deniedEmail } }),
      null,
      `${role} denial must not create a user`,
    );

    const userBeforeRoleChange = await prisma.user.findUnique({
      where: { id: target.id },
    });
    assert.ok(userBeforeRoleChange, `${role} target user must exist`);
    const setRole = await post(
      "/admin/set-role",
      { userId: target.id, role: "read_only" },
      cookie,
    );
    assert.equal(setRole.status, 403, `${role} role changes must be denied`);
    // The default Prisma result includes every persisted scalar User field; no fields are excluded.
    assert.deepEqual(
      await prisma.user.findUnique({ where: { id: target.id } }),
      userBeforeRoleChange,
      `${role} role-change denial must not mutate the user`,
    );

    const userBeforeBan = await prisma.user.findUnique({
      where: { id: target.id },
    });
    assert.ok(userBeforeBan, `${role} target user must still exist`);
    const banUser = await post(
      "/admin/ban-user",
      { userId: target.id, banReason: "integration test denial check" },
      cookie,
    );
    assert.equal(banUser.status, 403, `${role} bans must be denied`);
    assert.deepEqual(
      await prisma.user.findUnique({ where: { id: target.id } }),
      userBeforeBan,
      `${role} ban denial must not mutate the user`,
    );
  }

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

  const roleChange = await auth.api.setRole({
    body: { userId: operator.id, role: "read_only" },
    headers: new Headers({ cookie: administratorCookie }),
  });
  assert.equal(roleChange.user.role, "read_only");
  assert.equal(
    (
      await auth.api.getSession({
        headers: new Headers({ cookie: operatorCookie }),
      })
    )?.user.role,
    "read_only",
    "role changes must take effect in an existing session",
  );

  const signedOut = await post("/sign-out", {}, readOnlyCookie);
  assert.equal(signedOut.status, 200);
  assert.equal(
    await auth.api.getSession({
      headers: new Headers({ cookie: readOnlyCookie }),
    }),
    null,
  );

  await auth.api.banUser({
    body: { userId: operator.id, banReason: "integration test account disable" },
    headers: new Headers({ cookie: administratorCookie }),
  });
  assert.equal(
    await auth.api.getSession({
      headers: new Headers({ cookie: operatorCookie }),
    }),
    null,
    "disabling an account must revoke its existing session",
  );
});
