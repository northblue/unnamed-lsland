#!/bin/sh
# Run INSIDE the PostgreSQL container through UGREEN's terminal.
# The output directory must be a real bind mount, not the container layer.
set -eu
umask 077
backup_root=${BACKUP_ROOT:-/backups}
case "$backup_root" in /*) ;; *) echo 'Backup path must be absolute.' >&2; exit 1;; esac
if ! grep -Fq " $backup_root " /proc/self/mountinfo; then
  echo 'Backup directory is not mounted. Add ./backups:/backups in Compose first.' >&2
  exit 1
fi
export PGHOST=/var/run/postgresql
export PGUSER=nas_admin
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
partial="$backup_root/$stamp.partial"
complete="$backup_root/$stamp"
mkdir "$partial"
# Password hashes are included; never publish roles.sql or its contents.
pg_dumpall --globals-only > "$partial/roles.sql"
databases="$(psql -X -d postgres -Atqc "SELECT datname FROM pg_database WHERE NOT datistemplate AND datallowconn AND datname <> 'postgres' ORDER BY datname")"
[ -n "$databases" ] || { echo 'No application databases found.' >&2; exit 1; }
printf '%s\n' "$databases" > "$partial/databases.txt"
printf '%s\n' "$databases" | while IFS= read -r db; do
  case "$db" in ''|*[!a-z0-9_]*) echo 'Unexpected database name; backup aborted.' >&2; exit 1;; esac
  pg_dump --format=custom --dbname "$db" > "$partial/$db.dump"
  # Checks archive readability, NOT a full restore test.
  pg_restore --list "$partial/$db.dump" > "$partial/$db.contents.txt"
done
psql -X -d postgres -Atqc 'SELECT version()' > "$partial/server-version.txt"
printf '%s\n' 'Per-database snapshots, not a cross-database transaction. Restore rehearsal still required.' > "$partial/README.txt"
mv "$partial" "$complete"
printf 'Backup completed: %s\n' "$complete"
