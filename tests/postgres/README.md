# Disposable PostgreSQL integration tests

These tests are opt-in and are intended only for the dedicated disposable,
local PostgreSQL instance described below. Do not use Neon, a production URL,
a tunnel, or a database containing data that must be preserved.

## Prerequisites

- Docker Engine on Linux and the PostgreSQL image available locally.
- Node.js 20.19 or later, matching the installed Prisma 7.10 runtime
  requirement.

The runner accepts only role `imdad_test`, database `imdad_integration_test`,
port `55432`, and a loopback host. URI query parameters and fragments are
rejected to prevent connection-string overrides. Before invoking Prisma it
also checks `current_database()`, `current_user`, and `inet_server_addr()`; the
server address must be `127.0.0.1` or `::1`. This rejects ordinary remote
connections and TCP tunnels to servers that report their actual remote address.
The runner overrides `DATABASE_URL` for children and never prints the URL.

## Provision and validate

The commands below use Docker host networking, bind PostgreSQL to loopback,
and use a randomly generated test-only password held in the current shell.
They do not read `.env`. Run `docker pull` only after approval to download the
PostgreSQL image from Docker Hub; that pull has not been performed as part of
this preparation.

```sh
docker pull postgres:17
export IMDAD_TEST_DB_PASSWORD="$(openssl rand -hex 32)"
docker run --rm --detach --name imdad-postgres-test --network host \
  --env POSTGRES_USER=imdad_test \
  --env POSTGRES_PASSWORD="$IMDAD_TEST_DB_PASSWORD" \
  --env POSTGRES_DB=imdad_integration_test \
  postgres:17 postgres -c listen_addresses=127.0.0.1 -c port=55432
export IMDAD_TEST_DATABASE_URL="postgresql://imdad_test:${IMDAD_TEST_DB_PASSWORD}@127.0.0.1:55432/imdad_integration_test"
export IMDAD_ALLOW_DISPOSABLE_DATABASE=1
```

Wait for the container to report readiness using `docker logs imdad-postgres-test`
(do not print the URL or password). Validate the schema/config offline and then
validate the actual database identity:

```sh
npx prisma validate --config prisma.config.ts
node scripts/disposable-postgres.mjs --validate-only
```

The identity validation makes a database connection but does not migrate or
change data. Do not run it until you have explicitly approved database access
to this disposable instance.

## Run

First run the database-free guard tests:

```sh
npm run test:postgres:safety
```

After independently provisioning and verifying the disposable database, run:

```sh
npm run test:postgres:integration
```

The integration runner applies the checked-in migrations with the pinned Prisma
CLI and repository `prisma.config.ts`, then runs the PostgreSQL-backed auth
tests. It checks the database identity immediately before migrations. It does
not reset or drop the database. The migration is additive and should only be
run against a disposable database created for this purpose.

The integration suite creates an administrator solely as a test fixture in
that disposable database; it is not a production bootstrap mechanism. Tests
clean up their own fixture users. If a run is interrupted, discard and recreate
the disposable database rather than reusing uncertain test state.

The PostgreSQL suite currently covers Better Auth signup denial, sign-in/out,
session expiry, ban revocation, role changes, account provisioning, and
impersonation endpoint denial. Direct Next.js Server Action requests and the
report-export Route Handler still require a separate HTTP-level integration
suite; database-free authorization tests cover the export role decision.

## Cleanup

After tests finish, stop and remove only this named disposable container, then
clear its test-only shell variables:

```sh
docker stop imdad-postgres-test
unset IMDAD_TEST_DATABASE_URL IMDAD_TEST_DB_PASSWORD IMDAD_ALLOW_DISPOSABLE_DATABASE
```

The container uses no persistent volume; removing it deletes its disposable
database files.
