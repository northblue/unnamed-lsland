#!/bin/sh
# Optional terminal helper. GUI users edit .env.example on NAS instead.
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then
  printf '%s\n' '.env already exists; no values changed.'
  exit 0
fi
command -v openssl >/dev/null 2>&1 || { echo 'openssl is required.' >&2; exit 1; }
umask 077
(set -C
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      POSTGRES_PASSWORD=|ISLAND_DB_PASSWORD=|MIND_DB_PASSWORD=)
        printf '%s%s\n' "$line" "$(openssl rand -hex 32)" ;;
      *) printf '%s\n' "$line" ;;
    esac
  done < .env.example > .env
)
printf '%s\n' 'Prepared .env with random passwords; values were not printed.' 'Edit the NAS paths before starting.'
