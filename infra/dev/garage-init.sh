#!/usr/bin/env bash
# One-time Garage setup for the dev stack: node layout, dev key, buckets. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"

export PODMAN_COMPOSE_WARNING_LOGS=false
g() { podman compose -f compose.yaml exec -T -e RUST_LOG=warn garage /garage "$@"; }

KEY_ID=GK30eaaa5fc18c5caf9abb6b3c
KEY_SECRET=b9e70233a2e7160e36204070ad45eed4ec4877fde94320cb4c6b26a843f138db
BUCKETS=(products)

if g layout show | grep -q 'No nodes currently have a role'; then
  node=$(g node id -q | cut -d@ -f1)
  g layout assign -z dev -c 10G "$node" >/dev/null
  g layout apply --version 1 >/dev/null
fi

g key info "$KEY_ID" >/dev/null 2>&1 || g key import --yes -n dev "$KEY_ID" "$KEY_SECRET" >/dev/null

for b in "${BUCKETS[@]}"; do
  g bucket info "$b" >/dev/null 2>&1 || g bucket create "$b" >/dev/null
  g bucket allow --read --write --owner "$b" --key "$KEY_ID" >/dev/null
done

echo "Garage ready: buckets ${BUCKETS[*]}, key $KEY_ID"
