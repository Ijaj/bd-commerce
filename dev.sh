#!/usr/bin/env bash
# Starts everything for local development: containers (Postgres, Redis, Garage, imgproxy, Mailpit),
# DB migrations, then the API and the three apps in the background.
#
#   ./dev.sh [up]          start (idempotent: services that already listen are left alone)
#   ./dev.sh stop          stop the API and apps (containers keep running)
#   ./dev.sh stop --stack  also stop the containers
#   ./dev.sh status        show what listens where
#   ./dev.sh logs [name]   follow logs (api | admin | portal | shop; default: all)
#
# Flags for `up`: --no-stack (containers already running), --no-build (skip package rebuild).
# Logs and pid files live in .dev/ (git-ignored).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$PWD
STATE="$ROOT/.dev"
mkdir -p "$STATE/logs" "$STATE/pids"

export PODMAN_COMPOSE_WARNING_LOGS=false
COMPOSE="podman compose -f infra/dev/compose.yaml"
PG_CONTAINER=${E2E_PG_CONTAINER:-bdc-dev-postgres-1}

# name:port:command. The API listens on 4000 (admin/portal proxy /v1 there), shop on 3100.
SERVICES=(
  "api:4000:pnpm --filter @bdc/api dev"
  "admin:5173:pnpm --filter @bdc/admin dev"
  "portal:5190:pnpm --filter @bdc/portal dev"
  "shop:3100:pnpm --filter @bdc/shop dev"
)

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
listening() { ss -ltn "sport = :$1" 2>/dev/null | grep -q LISTEN; }

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

start_stack() {
  say "Containers"
  $COMPOSE up -d
  wait_for "Postgres" 60 podman exec "$PG_CONTAINER" pg_isready -U bdc
  # Idempotent: layout, dev key, buckets.
  infra/dev/garage-init.sh
}

prepare() {
  [[ -f .env ]] || { cp .env.example .env && say "Created .env from .env.example"; }
  if [[ ! -d node_modules ]]; then say "Installing dependencies"; pnpm install --frozen-lockfile; fi
  if [[ $BUILD == 1 ]]; then
    say "Building shared packages"
    pnpm turbo run build --filter='./packages/*'
  fi
  say "Prisma client + migrations"
  pnpm --filter @bdc/api prisma:generate
  (cd apps/api && pnpm exec prisma migrate deploy)
}

start_service() { # <name> <port> <command>
  local name=$1 port=$2 cmd=$3
  if listening "$port"; then
    echo "  $name: port $port already in use, leaving it alone"
    return
  fi
  # setsid: own process group, so `stop` can end the whole tree without touching anything else.
  API_URL=${API_URL:-http://localhost:4000} SITE_URL=${SITE_URL:-http://localhost:3100} \
    setsid bash -c "exec $cmd" >"$STATE/logs/$name.log" 2>&1 &
  echo $! >"$STATE/pids/$name.pid"
  echo "  $name: starting on :$port (log .dev/logs/$name.log)"
}

stop_service() { # <name>
  local pidfile="$STATE/pids/$1.pid"
  [[ -f $pidfile ]] || return 0
  local pid
  pid=$(<"$pidfile")
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    echo "  stopped $1"
  fi
  rm -f "$pidfile"
}

cmd_up() {
  STACK=1 BUILD=1
  for a in "$@"; do
    case $a in
      --no-stack) STACK=0 ;;
      --no-build) BUILD=0 ;;
      *) echo "unknown flag $a" >&2; exit 2 ;;
    esac
  done
  [[ $STACK == 1 ]] && start_stack
  prepare
  say "Apps"
  for s in "${SERVICES[@]}"; do
    IFS=: read -r name port cmd <<<"$s"
    start_service "$name" "$port" "$cmd"
  done
  wait_for "API health" 120 curl -fs http://localhost:4000/health ||
    echo "API not healthy yet: see .dev/logs/api.log" >&2
  for s in "${SERVICES[@]}"; do
    IFS=: read -r name port _ <<<"$s"
    wait_for "$name on :$port" 90 listening "$port" ||
      echo "$name not up yet: see .dev/logs/$name.log" >&2
  done
  cmd_status
  cat <<EOF

  Admin   http://localhost:5173
  Portal  http://localhost:5190
  Shop    http://localhost:3100
  API     http://localhost:4000  (docs: /docs)
  Mailpit http://localhost:8025

First time? Create an owner: pnpm --filter @bdc/api cli create-owner you@example.com "Your Name"
Demo catalog:                pnpm --filter @bdc/api cli seed-demo
Stop with ./dev.sh stop
EOF
}

cmd_stop() {
  say "Stopping apps"
  for s in "${SERVICES[@]}"; do stop_service "${s%%:*}"; done
  if [[ ${1:-} == --stack ]]; then
    say "Stopping containers"
    $COMPOSE down
  fi
}

cmd_status() {
  for s in "${SERVICES[@]}"; do
    IFS=: read -r name port _ <<<"$s"
    if listening "$port"; then printf '  %-7s :%-5s up\n' "$name" "$port"; else printf '  %-7s :%-5s down\n' "$name" "$port"; fi
  done
  for p in "postgres:5432" "redis:6379" "garage:3900" "imgproxy:8080" "mailpit:8025"; do
    if listening "${p#*:}"; then printf '  %-7s :%-5s up\n' "${p%:*}" "${p#*:}"; else printf '  %-7s :%-5s down\n' "${p%:*}" "${p#*:}"; fi
  done
}

cmd_logs() {
  if [[ -n ${1:-} ]]; then tail -n 50 -f "$STATE/logs/$1.log"; else tail -n 20 -f "$STATE"/logs/*.log; fi
}

case ${1:-up} in
  up) shift || true; cmd_up "$@" ;;
  stop) shift || true; cmd_stop "${1:-}" ;;
  status) cmd_status ;;
  logs) shift || true; cmd_logs "${1:-}" ;;
  *) sed -n 2,12p "$0"; exit 2 ;;
esac
