#!/bin/sh
# Rehearse this NAS's trusted dumps in NEW disposable databases only.
# Does not restore roles.sql, replace passwords, or target original databases.
set -eu
backup_root=${BACKUP_ROOT:-/backups}
snapshot=${1:?Provide a completed backup directory NAME}
case "$snapshot" in ''|*[!A-Za-z0-9_-]*) echo 'Use a completed backup directory name, not a path or .partial.' >&2; exit 1;; esac
case "$backup_root" in /*) ;; *) echo 'Backup root must be absolute.' >&2; exit 1;; esac
grep -Fq " $backup_root " /proc/self/mountinfo || { echo 'Backup root is not mounted.' >&2; exit 1; }
dir="$backup_root/$snapshot"
[ -s "$dir/databases.txt" ] || { echo 'Backup database list missing.' >&2; exit 1; }
# Validate all entries BEFORE creating any temporary database.
while IFS= read -r db || [ -n "$db" ]; do
  case "$db" in ''|*[!a-z0-9_]*) echo 'Unexpected database name in backup list.' >&2; exit 1;; esac
  [ -s "$dir/$db.dump" ] || { echo "Missing archive: $db" >&2; exit 1; }
done < "$dir/databases.txt"
export PGHOST=/var/run/postgresql PGUSER=nas_admin PGDATABASE=postgres
created_dbs=''
verified=0
cleanup() {
  status=$?
  trap - 0
  for checkdb in $created_dbs; do
    # Only names recorded AFTER a successful createdb are ever removed.
    if ! dropdb "$checkdb"; then
      echo "Temporary database cleanup failed: $checkdb" >&2
      status=1
    fi
  done
  if [ "$status" -eq 0 ] && [ "$verified" -eq 1 ]; then
    printf '%s\n' 'Restore check passed. Temporary databases removed; originals were not targeted.'
  fi
  exit "$status"
}
trap cleanup 0
trap 'exit 130' INT
trap 'exit 143' TERM
stamp="$(date -u +%Y%m%d%H%M%S)_$$"
count=0
while IFS= read -r db || [ -n "$db" ]; do
  count=$((count+1))
  checkdb="restorecheck_${stamp}_$count"
  # A collision aborts; no existing database is reused or added to cleanup.
  createdb --template=template0 --owner=nas_admin "$checkdb"
  created_dbs="$created_dbs $checkdb"
  psql -X -v ON_ERROR_STOP=1 -v target="$checkdb" -d postgres >/dev/null <<'SQL'
REVOKE ALL ON DATABASE :"target" FROM PUBLIC;
SQL
  # No --create, --clean or roles.sql: the original DBs / role passwords stay put.
  pg_restore --exit-on-error --single-transaction --dbname "$checkdb" "$dir/$db.dump"
  tables="$(psql -X -v ON_ERROR_STOP=1 -d "$checkdb" -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
  if [ "$db" = mind_friend ]; then
    vector="$(psql -X -v ON_ERROR_STOP=1 -d "$checkdb" -Atqc "SELECT extversion FROM pg_extension WHERE extname='vector'")"
    [ -n "$vector" ] || { echo 'Restored Mind Friend database has no vector extension.' >&2; exit 1; }
    printf 'PASS: %s archive restored, %s user tables, vector %s.\n' "$db" "$tables" "$vector"
  else
    printf 'PASS: %s archive restored, %s user tables.\n' "$db" "$tables"
  fi
done < "$dir/databases.txt"
verified=1
