# ImdadDZ

ImdadDZ is an inventory and purchasing application built with Next.js, Better
Auth, Prisma, and PostgreSQL. It provides inventory, suppliers, purchase
orders, reporting, and role-based account management.

## Local development

Use Node.js 20.19 or later and npm. Install dependencies with `npm ci`, set the
required server-side environment variables described below in your local
environment, then run `npm run dev`. Do not commit credentials or environment
files.

Available checks:

```sh
npm run lint
npm run build
node --experimental-strip-types --test src/lib/*.test.ts
npm run test:security-boundaries
npm run test:postgres:safety
npm run test:admin-bootstrap
```

The security-boundary test runner uses Node.js 22.15 or later for native
module hooks and module mocking.

The opt-in PostgreSQL integration workflow requires a separately approved,
dedicated disposable local database. Follow [the PostgreSQL test guide](./tests/postgres/README.md);
never point it at production or a shared database.

## Runtime configuration

The application requires these server-side variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma and the application. Use the approved environment's database endpoint and credentials. Production connections must use verified TLS and a trusted certificate. |
| `BETTER_AUTH_SECRET` | Private Better Auth signing/encryption secret. Generate a high-entropy secret and store it only in the environment's protected secret manager. |
| `BETTER_AUTH_URL` | Canonical base URL for the Better Auth endpoints in that environment. Use the exact HTTPS application origin in production. |

Set variables through your shell or a protected deployment secret manager. For
local development, use a git-ignored environment file or another private local
secret store; never paste secret values into source, documentation, tickets,
or logs. Do not use production credentials in local development. No deployment
provider or production environment has been configured or verified by this
repository review.

## Authentication and account provisioning

Email/password authentication is enabled and public signup is disabled.
Accounts are intended to be created by an administrator; new accounts default
to the `read_only` role. Read-only users can view inventory and reports,
inventory operators can perform designated inventory and purchasing
operations and export reports, and administrators receive the declared
application permissions. Administrators can manage accounts from the
user-management page; administrators cannot change or disable their own
account from that interface.

Public signup remains disabled. The one-time `npm run auth:bootstrap-admin`
command creates the first account through Better Auth only when the Neon
database has no users. It requires `DATABASE_URL` to be present in the process
environment (it will not fall back to a dotenv file), an explicit
`IMDAD_ALLOW_ADMIN_BOOTSTRAP=1` gate, `IMDAD_ADMIN_EMAIL`, and a
`IMDAD_ADMIN_PASSWORD` of at least 12 characters. Provide the bootstrap inputs
through a protected, temporary environment; never put the password in command
arguments, source files, or chat. The command serializes concurrent attempts,
refuses any non-Neon endpoint or non-empty user table, verifies the persisted
administrator role, and does not print credentials. Remove the temporary
bootstrap inputs from the secret manager after successful provisioning.

## Production and release checklist

Production readiness has not been verified. Before release, the responsible
operators should:

- Confirm the supported Node.js runtime and securely provision
  `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` for the
  production environment.
- Confirm HTTPS, trusted database TLS, database network restrictions, least
  privilege for the application database role, and correct proxy/host handling.
- Resolve and approve the first-administrator provisioning procedure without
  enabling public signup.
- Review every pending Prisma migration and its operational impact. Do not
  edit or skip migrations as an ad hoc recovery technique.
- Take a verified database backup before schema changes. Confirm restore
  instructions and recovery objectives, and rehearse recovery in a separate
  non-production environment.
- Apply reviewed migrations through the approved release process with
  `npx prisma migrate deploy --config prisma.config.ts`; verify migration
  status and application health afterward. Do not run development migration
  commands against production.
- Define monitoring, alerting, access review, incident response, and rollback
  or forward-recovery ownership before launch.
- Run the project checks in the release environment. The database-free
  `test:security-boundaries` suite invokes the report-export Route Handler and
  managed-user Server Actions with isolated auth/database substitutes; it does
  not replace the PostgreSQL-backed integration suite or production
  verification.

Database backups, restore procedures, production migrations, and production
configuration must be verified by authorized operators. This documentation
does not claim that any production environment has been contacted or validated.
