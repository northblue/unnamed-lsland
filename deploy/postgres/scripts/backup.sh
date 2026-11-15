#!/bin/sh
# BACKUP_DIR is a required absolute NAS path; no credentials are printed.
set -eu
cd "$(dirname "$0")/.."
: "${BACKUP_DIR:?Set BACKUP_DIR to the NAS backup root}"
case "$BACKUP_DIR" in /*) ;; *) echo 'BACKUP_DIR must be absolute.' >&2; exit 1;; esac
umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$BACKUP_DIR"
partial="$BACKUP_DIR/$stamp.partial"
complete="$BACKUP_DIR/$stamp"
mkdir "$partial"
# Keep failed snapshots clearly marked .partial; never advertise them as complete.
docker compose exec -T postgres pg_dumpall -U nas_admin --globals-only > "$partial/roles.sql"
databases="$(docker compose exec -T postgres psql -X -U nas_admin -d postgres -Atqc "SELECT datname FROM pg_database WHERE NOT datistemplate AND datallowconn AND datname <> 'postgres' ORDER BY datname")"
[ -n "$databases" ] || { echo 'No application databases found.' >&2; exit 1; }
printf '%s\n' "$databases" > "$partial/databases.txt"
printf '%s\n' "$databases" | while IFS= read -r db; do
  case "$db" in ''|*[!a-z0-9_]*) echo 'Unexpected database name; backup aborted.' >&2; exit 1;; esac
  docker compose exec -T postgres pg_dump -U nas_admin --format=custom --dbname "$db" > "$partial/$db.dump"
done
docker compose images -q postgres > "$partial/image-id.txt"
printf '%s\n' 'Per-database pg_dump snapshots; not a single cross-database transaction.' > "$partial/README.txt"
mv "$partial" "$complete"
printf 'Backup completed: %s\n' "$complete"
