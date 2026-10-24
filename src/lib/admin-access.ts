import { createAccessControl } from "better-auth/plugins/access";

const statements = {
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "impersonate-admins",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
} as const;

export const adminAccessControl = createAccessControl(statements);

export const adminPluginRoles = {
  read_only: adminAccessControl.newRole({
    user: [],
    session: [],
  }),
  inventory_operator: adminAccessControl.newRole({
    user: [],
    session: [],
  }),
  administrator: adminAccessControl.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "delete",
      "set-password",
      "set-email",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
} as const;
