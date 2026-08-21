# Fastify database source of truth

## Current deployment

The Fastify runtime uses the SQLite file resolved from `DATABASE_URL` (by
default `api/prisma/dev.db`) through Prisma's Better SQLite adapter. The
runtime schema is the checked-in `api/prisma/schema.prisma`, and the SQLite
file is the current local deployment snapshot containing the migrated
Fastify-era tables (sessions, opaque access grants, devices, security events,
E2EE, resources and admin data).

The legacy Nest migration folders remain historical database history. They do
not by themselves describe every newer Fastify model, so a fresh deployment
must not assume that replaying only the old migration chain creates the full
current schema.

## Safe operating rules

- Never delete, reset, or recreate `api/prisma/dev.db` as part of a build or
  restart.
- Take a file-level backup before schema work or data repair.
- Run `npm.cmd run build:fastify` after changing the Prisma schema so the
  generated client is refreshed.
- Run the Fastify contract suite against a copied database, not the live
  development file.
- Treat a missing table/column as `DATABASE_SCHEMA_UNAVAILABLE`; do not turn
  it into an empty authenticated result.

## Deployment baseline decision

Until a reviewed baseline migration is generated from the complete schema,
SQLite snapshot provisioning is the deployment source. A future PostgreSQL
or clean-install migration must be introduced as a separate change with:

1. a schema-to-empty baseline generated from the complete Prisma schema;
2. a copy/import plan for existing users, sessions, files and trust data;
3. a dry-run against a backup and contract tests for every Fastify module;
4. an explicit cutover and rollback procedure.

Do not manufacture a partial migration by copying only the old Nest tables:
that recreates the earlier API while silently omitting the security and E2EE
tables the current runtime requires.
