#!/usr/bin/env bash
# Executed only by the official entrypoint on a NEW, empty PGDATA.
set -euo pipefail
export ISLAND_DB_PASSWORD MIND_DB_PASSWORD
: "${ISLAND_DB_PASSWORD:?Missing island password}"
: "${MIND_DB_PASSWORD:?Missing mind password}"
: "${POSTGRES_PASSWORD:?Missing admin password}"
[ "${#ISLAND_DB_PASSWORD}" -ge 32 ] && [ "${#MIND_DB_PASSWORD}" -ge 32 ] && [ "${#POSTGRES_PASSWORD}" -ge 32 ] || { echo 'All passwords must have at least 32 characters.' >&2; exit 1; }
[ "$ISLAND_DB_PASSWORD" != "$MIND_DB_PASSWORD" ] && [ "$ISLAND_DB_PASSWORD" != "$POSTGRES_PASSWORD" ] && [ "$MIND_DB_PASSWORD" != "$POSTGRES_PASSWORD" ] || { echo 'Use three different passwords.' >&2; exit 1; }
psql -X --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
\getenv island_password ISLAND_DB_PASSWORD
\getenv mind_password MIND_DB_PASSWORD
CREATE ROLE island_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 15 PASSWORD :'island_password';
CREATE ROLE mind_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 15 PASSWORD :'mind_password';
CREATE DATABASE unnamed_island OWNER island_app TEMPLATE template0 ENCODING 'UTF8';
CREATE DATABASE mind_friend OWNER mind_app TEMPLATE template0 ENCODING 'UTF8';
REVOKE ALL ON DATABASE unnamed_island FROM PUBLIC;
REVOKE ALL ON DATABASE mind_friend FROM PUBLIC;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
GRANT CONNECT ON DATABASE unnamed_island TO island_app;
GRANT CONNECT ON DATABASE mind_friend TO mind_app;
\connect unnamed_island
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO island_app;
\connect mind_friend
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO mind_app;
CREATE EXTENSION vector;
SQL
unset ISLAND_DB_PASSWORD MIND_DB_PASSWORD
