#!/bin/sh
# bdc-api entrypoint.
#   (no args)   prisma migrate deploy, then start the API
#   migrate     prisma migrate deploy only
#   cli <cmd>   run an API CLI command (create-owner, seed-pages, ...) without migrating
#   anything else is exec'd as given
set -eu
cd /app

migrate() {
  # Postgres may still be starting (healthchecks can't gate it where `podman exec` is broken).
  i=0
  until node /app/node_modules/prisma/build/index.js migrate deploy --config /app/prisma.config.ts; do
    i=$((i + 1))
    [ "$i" -ge 15 ] && echo "migrate deploy failed after $i tries" >&2 && exit 1
    sleep 2
  done
}

case "${1:-}" in
  "")
    migrate
    exec node --enable-source-maps dist/main.js
    ;;
  migrate)
    migrate
    ;;
  cli)
    shift
    exec node --enable-source-maps dist/cli.js "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
