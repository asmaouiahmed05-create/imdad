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
npm run test:postgres:safety
```

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
application permissions.

**First administrator provisioning is unresolved.** A fresh database has no
documented, approved process to create its first administrator, and public
signup must remain disabled. Do not enable public registration or manually
insert an administrator as a workaround. Production release is blocked until
an authorized, auditable bootstrap procedure is designed, reviewed, and
approved.

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
- Run the project checks in the release environment. The PostgreSQL test guide
  documents the isolated integration suite, but it does not exercise direct
  HTTP requests to the Next.js report-export Route Handler or privileged
  Server Actions. Those request-boundary tests remain a coverage gap.

Database backups, restore procedures, production migrations, and production
configuration must be verified by authorized operators. This documentation
does not claim that any production environment has been contacted or validated.
