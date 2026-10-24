import assert from "node:assert/strict";
import test from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { admin } from "better-auth/plugins";
import { createAuthOptions } from "./auth-config.ts";
import { adminAccessControl, adminPluginRoles } from "./admin-access.ts";

const TEST_BASE_URL = "http://localhost/api/auth";
const TEST_PASSWORD = "local-test-password-123";
const TEST_SECRET = "unit-test-secret-not-used-outside-tests";

function createMemoryDatabase() {
  return { user: [], session: [], account: [], verification: [] };
}

function createTestAuth(publicSignUp: boolean, defaultRole = "administrator") {
  const options = createAuthOptions(memoryAdapter(createMemoryDatabase()));
  return betterAuth({
    ...options,
    secret: TEST_SECRET,
    baseURL: TEST_BASE_URL,
    emailAndPassword: {
      enabled: true,
      disableSignUp: !publicSignUp,
      minPasswordLength: 12,
    },
    plugins: [
      admin({
        ac: adminAccessControl,
        roles: adminPluginRoles,
        adminRoles: ["administrator"],
        defaultRole,
      }),
    ],
  });
}

async function post<TAuth extends { handler: (request: Request) => Promise<Response> }>(
  auth: TAuth,
  path: string,
  body: Record<string, unknown>,
  cookie?: string,
) {
  return auth.handler(
    new Request(`${TEST_BASE_URL}${path}`, {
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

function cookieFrom(response: Response) {
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0])
    .join("; ");
  assert.ok(cookies, "expected Better Auth to issue a session cookie");
  return cookies;
}

async function signIn<TAuth extends { handler: (request: Request) => Promise<Response> }>(
  auth: TAuth,
  email: string,
  password = TEST_PASSWORD,
) {
  const response = await post(auth, "/sign-in/email", { email, password });
  assert.equal(response.status, 200);
  return cookieFrom(response);
}

async function createUser<TAuth extends { handler: (request: Request) => Promise<Response> }>(
  auth: TAuth,
  adminCookie: string,
  email: string,
  role: string,
) {
  const response = await post(
    auth,
    "/admin/create-user",
    { name: role, email, password: TEST_PASSWORD, role },
    adminCookie,
  );
  if (response.status !== 200) {
    throw new Error(`Account provisioning failed with status ${response.status}.`);
  }
  return (await response.json() as { user: { id: string } }).user;
}

test("production Better Auth config disables public signup", async () => {
  const options = createAuthOptions(
    memoryAdapter(createMemoryDatabase()),
  );
  assert.equal(options.emailAndPassword?.disableSignUp, true);
  assert.equal(options.session?.expiresIn, 12 * 60 * 60);
  assert.equal(options.session?.disableSessionRefresh, true);
  assert.equal(options.session?.cookieCache?.enabled, false);

  const auth = betterAuth({
    ...options,
    secret: TEST_SECRET,
    baseURL: TEST_BASE_URL,
  });
  const response = await post(auth, "/sign-up/email", {
    name: "Unapproved account",
    email: "unapproved@example.test",
    password: TEST_PASSWORD,
  });
  assert.notEqual(response.status, 200);
});

test("admin plugin enforces provisioning, bans, and no impersonation for every role", async () => {
  const auth = createTestAuth(true);
  const adminSignUp = await post(auth, "/sign-up/email", {
    name: "Administrator",
    email: "admin@example.test",
    password: TEST_PASSWORD,
  });
  assert.equal(adminSignUp.status, 200);
  const adminCookie = cookieFrom(adminSignUp);

  const readOnly = await createUser(
    auth,
    adminCookie,
    "readonly@example.test",
    "read_only",
  );
  const operator = await createUser(
    auth,
    adminCookie,
    "operator@example.test",
    "inventory_operator",
  );

  for (const role of [
    "read_only",
    "inventory_operator",
    "administrator",
  ] as const) {
    assert.equal(
      adminPluginRoles[role].authorize({
        user: ["impersonate", "impersonate-admins"],
      }).success,
      false,
      `${role} must not receive impersonation permissions`,
    );
  }

  const noSessionCreate = await post(auth, "/admin/create-user", {
    name: "Denied",
    email: "denied@example.test",
    password: TEST_PASSWORD,
    role: "read_only",
  });
  assert.notEqual(noSessionCreate.status, 200);

  const readOnlyCookie = await signIn(auth, "readonly@example.test");
  const operatorCookie = await signIn(auth, "operator@example.test");
  for (const [index, cookie] of [readOnlyCookie, operatorCookie].entries()) {
    const denied = await post(
      auth,
      "/admin/create-user",
      {
        name: "Denied",
        email: `denied-${index}@example.test`,
        password: TEST_PASSWORD,
        role: "read_only",
      },
      cookie,
    );
    assert.equal(denied.status, 403);
  }

  const provisioned = await post(
    auth,
    "/admin/create-user",
    {
      name: "Provisioned",
      email: "provisioned@example.test",
      password: TEST_PASSWORD,
      role: "read_only",
    },
    adminCookie,
  );
  assert.equal(provisioned.status, 200);

  const roleSessions = [
    { role: "read_only", cookie: readOnlyCookie },
    { role: "inventory_operator", cookie: operatorCookie },
    { role: "administrator", cookie: adminCookie },
  ];
  for (const { role, cookie } of roleSessions) {
    const impersonate = await post(
      auth,
      "/admin/impersonate-user",
      { userId: role === "administrator" ? readOnly.id : operator.id },
      cookie,
    );
    assert.equal(impersonate.status, 403, `${role} impersonation must be denied`);

    const stop = await post(auth, "/admin/stop-impersonating", {}, cookie);
    assert.notEqual(stop.status, 200, `${role} cannot create an impersonation`);
    const currentSession = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    assert.ok(currentSession);
    assert.equal(currentSession.session.impersonatedBy, undefined);
  }

  const targetCookie = await signIn(auth, "readonly@example.test");
  assert.ok(
    await auth.api.getSession({ headers: new Headers({ cookie: targetCookie }) }),
  );
  await auth.api.banUser({
    body: { userId: readOnly.id, banReason: "disabled by test" },
    headers: new Headers({ cookie: adminCookie }),
  });
  assert.equal(
    await auth.api.getSession({ headers: new Headers({ cookie: targetCookie }) }),
    null,
    "banning a user must revoke the previously valid session",
  );
});
