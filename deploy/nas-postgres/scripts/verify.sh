#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose exec -T postgres bash -eu <<'SH'
check_project() {
  local role="$1" db="$2" other="$3"
  local password="$4"
  export PGPASSWORD
  PGPASSWORD="$password"
  # TCP forces password authentication; Unix socket health alone is insufficient.
  psql -X -h 127.0.0.1 -U "$role" -d "$db" -v ON_ERROR_STOP=1 -q >/dev/null <<'SQL'
BEGIN;
CREATE TABLE public.__deployment_probe (id integer PRIMARY KEY);
INSERT INTO public.__deployment_probe VALUES (1);
SELECT * FROM public.__deployment_probe;
ROLLBACK;
SQL
  if psql -X -h 127.0.0.1 -U "$role" -d "$other" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "FAIL: $role can connect to another project's database" >&2; exit 1
  fi
  if psql -X -h 127.0.0.1 -U "$role" -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
    echo "FAIL: $role can connect to the admin database" >&2; exit 1
  fi
  unset PGPASSWORD
  printf 'PASS: %s authenticated, read/wrote its own database, denied cross-project access.\n' "$role"
}
check_project island_app unnamed_island mind_friend "$ISLAND_DB_PASSWORD"
check_project mind_app mind_friend unnamed_island "$MIND_DB_PASSWORD"
version="$(psql -X -U "$POSTGRES_USER" -d mind_friend -Atqc "SELECT extversion FROM pg_extension WHERE extname='vector'")"
[ -n "$version" ] || { echo 'FAIL: vector extension missing' >&2; exit 1; }
printf 'PASS: mind_friend vector extension %s.\n' "$version"
SH
