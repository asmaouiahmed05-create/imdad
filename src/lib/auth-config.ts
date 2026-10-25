import type { BetterAuthOptions } from "better-auth";
import { admin } from "better-auth/plugins";
import { adminAccessControl, adminPluginRoles } from "./admin-access.ts";

export function createAuthOptions(database: BetterAuthOptions["database"]) {
  return {
    appName: "ImdadDZ",
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
    },
    session: {
      expiresIn: 60 * 60 * 12,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    disabledPaths: ["/admin/stop-impersonating"],
    plugins: [
      admin({
        ac: adminAccessControl,
        roles: adminPluginRoles,
        adminRoles: ["administrator"],
        defaultRole: "read_only",
      }),
    ],
  } satisfies BetterAuthOptions;
}
