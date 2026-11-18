#!/usr/bin/env bash
# Update the prod stack: git pull (ff only), build the 3 images, compose up, wait for the API health check.
#   ./deploy.sh [--no-pull]   (--no-pull skips git pull)
# Migrations run in the api entrypoint. Needs infra/prod/.env (see gen-secrets.sh).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$(git rev-parse --show-toplevel)
export PODMAN_COMPOSE_WARNING_LOGS=false

PULL=1
for arg in "$@"; do
  case $arg in
    --no-pull) PULL=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done
[[ -f .env ]] || { echo "infra/prod/.env missing: run ./gen-secrets.sh first." >&2; exit 1; }

# Read one value from .env without sourcing it (MAIL_FROM has spaces and <>).
envval() { grep -m1 "^$1=" .env | cut -d= -f2- | sed -e "s/^'//" -e "s/'\$//"; }
BASE_DOMAIN=$(envval BASE_DOMAIN)
PUBLIC_SCHEME=$(envval PUBLIC_SCHEME)
HTTP_PORT=$(envval HTTP_PORT)
HTTP_PORT=${HTTP_PORT:-8088}
HTTPS_PORT=$(envval HTTPS_PORT)
HTTPS_PORT=${HTTPS_PORT:-8443}
[[ -n $BASE_DOMAIN ]] || { echo "BASE_DOMAIN is empty in .env" >&2; exit 1; }
SITE_URL="${PUBLIC_SCHEME:-https}://$BASE_DOMAIN"

if [[ $PULL == 1 ]]; then
  echo "[deploy] git pull --ff-only"
  git -C "$ROOT" pull --ff-only
fi

echo "[deploy] building images"
cd "$ROOT"
podman build -f infra/prod/api.Containerfile -t localhost/bdc-api:latest .
podman build -f infra/prod/shop.Containerfile -t localhost/bdc-shop:latest \
  --build-arg API_URL=http://api:4000 --build-arg SITE_URL="$SITE_URL" .
podman build -f infra/prod/web.Containerfile -t localhost/bdc-web:latest \
  --build-arg SITE_URL="$SITE_URL" .
cd "$ROOT/infra/prod"

echo "[deploy] compose up"
podman compose -f compose.yaml up -d --no-build
# Compose may keep a container whose image tag was just rebuilt; recreate the app services to be sure.
podman compose -f compose.yaml up -d --no-build --force-recreate api shop web

# Front door check through Caddy, correct for both modes. http: plain request with the api. Host header.
# https: TLS request pinned to this PC (-k because the certificate may not be issued yet).
front_door_ok() {
  if [[ ${PUBLIC_SCHEME:-https} == http ]]; then
    curl -sf -H "Host: api.$BASE_DOMAIN" "http://127.0.0.1:$HTTP_PORT/health" >/dev/null
  else
    curl -skf --resolve "api.$BASE_DOMAIN:$HTTPS_PORT:127.0.0.1" "https://api.$BASE_DOMAIN:$HTTPS_PORT/health" >/dev/null
  fi
}

echo "[deploy] waiting for the API (up to 120 s)"
for ((i = 0; i < 120; i++)); do
  if front_door_ok; then
    echo "[deploy] API healthy after ${i}s. Site: $SITE_URL"
    exit 0
  fi
  sleep 1
done
# https mode on a first start: Caddy has no certificate until DNS points here and Let's Encrypt
# answers. Fall back to the API container's own health check so a DNS delay is not a failed deploy.
if [[ $(podman inspect -f '{{.State.Health.Status}}' bdc-prod-api-1 2>/dev/null) == healthy ]]; then
  echo "[deploy] API container is healthy, but $SITE_URL did not answer through Caddy yet." >&2
  echo "[deploy] Check DNS, the router port forwards and: podman compose -f compose.yaml logs --tail 40 web" >&2
  exit 0
fi
echo "[deploy] API did not become healthy within 120 s. Last api logs:" >&2
podman compose -f compose.yaml logs --tail 40 api >&2 || true
exit 1
