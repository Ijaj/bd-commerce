#!/usr/bin/env bash
# Restore a backup made by backup.sh. DESTRUCTIVE: replaces the app DB and the Garage volumes.
#   ./restore.sh <backup-dir> --yes
# Does not restore prod.env (copy it back by hand if the secrets changed). Without --yes it only prints the plan.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT=${PROJECT:-bdc-prod}
PG_CONTAINER=${PG_CONTAINER:-$PROJECT-postgres-1}
PG_USER=bdc
PG_DB=bdc
export PODMAN_COMPOSE_WARNING_LOGS=false
COMPOSE=(podman compose -f compose.yaml)

src=${1:-}
confirm=${2:-}
[[ -n $src ]] || { echo "usage: $0 <backup-dir> --yes" >&2; exit 2; }
[[ -f $src/db.dump && -f $src/garage-meta.tar.gz && -f $src/garage-data.tar.gz ]] \
  || { echo "$src is not a complete backup (db.dump, garage-meta.tar.gz, garage-data.tar.gz)." >&2; exit 1; }
if [[ $confirm != --yes ]]; then
  echo "This replaces the database $PG_DB and the volumes ${PROJECT}_garage-meta/-data with the contents of:"
  echo "  $src"
  echo "Re-run with --yes to proceed."
  exit 2
fi

# Same exec-then-sidecar fallback as backup.sh.
ctr_run() { # <container> <command...>  (stdin passes through)
  local c=$1; shift
  podman exec -i -e PGPASSWORD "$c" "$@" 2>/dev/null && return 0
  podman run --rm -i --network "container:$c" --volumes-from "$c" -e PGPASSWORD \
    "$(podman inspect -f '{{.ImageName}}' "$c")" "$@"
}
PGPASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' .env | cut -d= -f2- | sed -e "s/^'//" -e "s/'\$//")
export PGPASSWORD

echo "[restore] stopping api, shop, garage"
"${COMPOSE[@]}" stop api shop garage

echo "[restore] database"
ctr_run "$PG_CONTAINER" pg_restore --clean --if-exists --no-owner -U "$PG_USER" -d "$PG_DB" < "$src/db.dump"

for vol in garage-meta garage-data; do
  v="${PROJECT}_$vol"
  echo "[restore] volume $v"
  # Empty the volume first (import only overwrites files present in the archive).
  podman run --rm -v "$v:/vol" docker.io/library/postgres:18-alpine sh -c 'rm -rf /vol/* /vol/.[!.]* 2>/dev/null; true'
  podman volume import "$v" "$src/$vol.tar.gz"
done

echo "[restore] starting stack"
"${COMPOSE[@]}" up -d --no-build
echo "[restore] done. Check: curl -sf -H 'Host: api.<BASE_DOMAIN>' http://127.0.0.1:<HTTP_PORT>/health"
