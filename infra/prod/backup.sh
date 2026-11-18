#!/usr/bin/env bash
# Nightly backup of the prod stack into ${BACKUP_DIR:-$HOME/bdc-backups}/<YYYYmmdd-HHMM>/:
#   db.dump           pg_dump -Fc of the app DB
#   garage-meta.tar.gz, garage-data.tar.gz   Garage volumes (podman volume export)
#   prod.env          copy of infra/prod/.env (mode 600). WARNING: holds secrets (DB/S3/TOTP/payout keys).
#                     Keep it off shared storage; losing STAFF_TOTP_KEY or AFFILIATE_PAYOUT_KEY is unrecoverable.
# Keeps the newest KEEP (default 14) backup dirs. Run by bdc-backup.timer (systemd/).
set -euo pipefail
cd "$(dirname "$0")"

PROJECT=${PROJECT:-bdc-prod}
PG_CONTAINER=${PG_CONTAINER:-$PROJECT-postgres-1}
BACKUP_DIR=${BACKUP_DIR:-$HOME/bdc-backups}
KEEP=${KEEP:-14}
[[ -f .env ]] || { echo "infra/prod/.env missing." >&2; exit 1; }

# Read one value from .env without sourcing it (MAIL_FROM has spaces and <>).
envval() { grep -m1 "^$1=" .env | cut -d= -f2- | sed -e "s/^'//" -e "s/'\$//"; }
PG_USER=bdc
PG_DB=bdc
PG_PASSWORD=$(envval POSTGRES_PASSWORD)
export PGPASSWORD=$PG_PASSWORD

# Run a command in the container; podman exec is broken on some rootless setups (oom_score_adj EACCES),
# so fall back to a sidecar that shares the container's network and volumes (same as dev.sh ctr_exec).
ctr_run() { # <container> <command...>  (stdin passes through)
  local c=$1; shift
  podman exec -i -e PGPASSWORD "$c" "$@" 2>/dev/null && return 0
  podman run --rm -i --network "container:$c" --volumes-from "$c" -e PGPASSWORD \
    "$(podman inspect -f '{{.ImageName}}' "$c")" "$@"
}

ts=$(date +%Y%m%d-%H%M)
mkdir -p "$BACKUP_DIR"
final="$BACKUP_DIR/$ts"
tmp="$BACKUP_DIR/.tmp-$ts"
if [[ -e $final ]]; then echo "$final already exists." >&2; exit 1; fi
rm -rf "$tmp"; mkdir -m 700 "$tmp"
trap 'rm -rf "$tmp"' EXIT

echo "[backup] database -> db.dump"
ctr_run "$PG_CONTAINER" pg_dump -Fc -U "$PG_USER" -d "$PG_DB" > "$tmp/db.dump"
[[ -s $tmp/db.dump ]] || { echo "pg_dump produced an empty file." >&2; exit 1; }
[[ $(head -c5 "$tmp/db.dump") == PGDMP ]] || { echo "db.dump is not a custom-format dump." >&2; exit 1; }

for vol in garage-meta garage-data; do
  echo "[backup] volume $PROJECT""_$vol -> $vol.tar.gz"
  podman volume export "${PROJECT}_$vol" | gzip -6 > "$tmp/$vol.tar.gz"
done

echo "[backup] copy .env (secrets!)"
install -m 600 .env "$tmp/prod.env"

mv "$tmp" "$final"
trap - EXIT

# Retention: keep the newest $KEEP timestamped dirs (hidden .tmp- dirs are ignored).
mapfile -t all < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*-[0-9]*' | sort)
extra=$(( ${#all[@]} - KEEP ))
for ((i = 0; i < extra; i++)); do
  echo "[backup] pruning ${all[i]}"
  rm -rf -- "${all[i]}"
done

echo "[backup] done: $final ($(du -sh "$final" | cut -f1))"
