#!/usr/bin/env bash
# One-time setup of the prod stack after the first `podman compose up -d`. Idempotent: safe to re-run.
#   Garage: node layout, S3 key (from .env), bucket `products`.
#   API:    static pages (published). With ALPHA_SETTINGS=1 (default) the relaxed checkout/call-queue/refund
#           limits of the alpha test (the CLI refuses them under NODE_ENV=production, so it runs as development).
# Geo data and couriers come with the migrations. Afterwards create the first Owner (printed at the end).
set -euo pipefail
cd "$(dirname "$0")"

export PODMAN_COMPOSE_WARNING_LOGS=false
COMPOSE="podman compose -f compose.yaml"
GARAGE_CONTAINER=${GARAGE_CONTAINER:-bdc-prod-garage-1}
ALPHA_SETTINGS=${ALPHA_SETTINGS:-1}

[[ -f .env ]] || { echo "infra/prod/.env missing: run ./gen-secrets.sh first." >&2; exit 1; }
envval() { grep -m1 "^$1=" .env | cut -d= -f2- | sed -e "s/^'//" -e "s/'\$//"; }
KEY_ID=$(envval S3_ACCESS_KEY_ID)
KEY_SECRET=$(envval S3_SECRET_ACCESS_KEY)
BUCKETS=(products)

# `podman exec` can fail on rootless podman 6.2 + crun 1.31 (oom_score_adj EACCES); then run the
# CLI in a sidecar that shares the garage container's network and config volume.
g() {
  podman exec -e RUST_LOG=warn "$GARAGE_CONTAINER" /garage "$@" 2>/dev/null && return 0
  podman run --rm --network "container:$GARAGE_CONTAINER" --volumes-from "$GARAGE_CONTAINER" \
    -e RUST_LOG=warn -e GARAGE_RPC_SECRET="$(envval GARAGE_RPC_SECRET)" -e GARAGE_ADMIN_TOKEN="$(envval GARAGE_ADMIN_TOKEN)" \
    "$(podman inspect -f '{{.ImageName}}' "$GARAGE_CONTAINER")" /garage "$@"
}

wait_for() { # <label> <seconds> <command...>
  local label=$1 secs=$2
  shift 2
  for ((i = 0; i < secs; i++)); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "Timed out waiting for $label" >&2
  return 1
}
# Through Caddy, so it needs no `podman exec` (healthchecks can be broken on rootless podman).
api_up() { curl -fsS -o /dev/null -H "Host: api.$(envval BASE_DOMAIN)" "http://127.0.0.1:$(envval HTTP_PORT)/health"; }

echo "== Garage"
wait_for "Garage" 60 g status
if g layout show | grep -q 'No nodes currently have a role'; then
  node=$(g node id -q | cut -d@ -f1)
  g layout assign -z prod -c "${GARAGE_CAPACITY:-100G}" "$node" >/dev/null
  g layout apply --version 1 >/dev/null
fi
g key info "$KEY_ID" >/dev/null 2>&1 || g key import --yes -n prod "$KEY_ID" "$KEY_SECRET" >/dev/null
for b in "${BUCKETS[@]}"; do
  g bucket info "$b" >/dev/null 2>&1 || g bucket create "$b" >/dev/null
  g bucket allow --read --write --owner "$b" --key "$KEY_ID" >/dev/null
done
echo "Garage ready: buckets ${BUCKETS[*]}, key $KEY_ID"

echo "== API (waiting for migrations + health)"
wait_for "API health" 300 api_up
$COMPOSE run --rm -T --no-deps api cli seed-pages --publish
if [[ $ALPHA_SETTINGS == 1 ]]; then
  $COMPOSE run --rm -T --no-deps -e NODE_ENV=development api cli alpha-settings
fi

cat <<MSG

Done. Create the first Owner (prints a temporary password; 2FA is set up on first sign-in):
  podman compose -f infra/prod/compose.yaml run --rm -T --no-deps api cli create-owner you@example.com "Your Name"
Then sign in at $(envval PUBLIC_SCHEME)://admin.$(envval BASE_DOMAIN)$([[ $(envval HTTP_PORT) ]] && [[ $(envval BASE_DOMAIN) == *localhost ]] && echo ":$(envval HTTP_PORT)").
MSG
