#!/usr/bin/env bash
# Creates infra/prod/.env from .env.example with fresh secrets. Refuses to overwrite an existing file.
#   BASE_DOMAIN=example.com PUBLIC_SCHEME=https ./gen-secrets.sh
set -euo pipefail
cd "$(dirname "$0")"

OUT=${OUT:-.env}
if [[ -e $OUT ]]; then
  echo "$OUT already exists; refusing to overwrite (delete it by hand if you really want new secrets)." >&2
  exit 1
fi

hex() { openssl rand -hex "$1"; }
BASE_DOMAIN=${BASE_DOMAIN:-bdc.localhost}
if [[ -z ${PUBLIC_SCHEME:-} ]]; then
  if [[ $BASE_DOMAIN == *.localhost || $BASE_DOMAIN == localhost ]]; then PUBLIC_SCHEME=http; else PUBLIC_SCHEME=https; fi
fi

MAIL_PASSWORD=$(hex 12)
bcrypt() {
  local pw=$1
  podman run --rm docker.io/library/caddy:2 caddy hash-password --plaintext "$pw" 2>/dev/null ||
    htpasswd -nbBC 12 x "$pw" 2>/dev/null | cut -d: -f2 ||
    python3 -c 'import bcrypt,sys;print(bcrypt.hashpw(sys.argv[1].encode(),bcrypt.gensalt()).decode())' "$pw"
}
MAIL_HASH=$(bcrypt "$MAIL_PASSWORD" | tail -n1)
[[ $MAIL_HASH == \$2* ]] || { echo "Could not create a bcrypt hash (need podman, htpasswd or python bcrypt)." >&2; exit 1; }

declare -A V=(
  [BASE_DOMAIN]=$BASE_DOMAIN
  [PUBLIC_SCHEME]=$PUBLIC_SCHEME
  [POSTGRES_PASSWORD]=$(hex 24)
  [GARAGE_RPC_SECRET]=$(hex 32)
  [GARAGE_ADMIN_TOKEN]=$(hex 24)
  [S3_ACCESS_KEY_ID]=GK$(hex 12)
  [S3_SECRET_ACCESS_KEY]=$(hex 32)
  [IMGPROXY_KEY]=$(hex 32)
  [IMGPROXY_SALT]=$(hex 32)
  [STAFF_TOTP_KEY]=$(hex 32)
  [AFFILIATE_PAYOUT_KEY]=$(hex 32)
  [OTP_SECRET]=$(hex 32)
  [MAIL_UI_PASSWORD]=$MAIL_PASSWORD
  [MAIL_UI_HASH]="'$MAIL_HASH'"
  [MAIL_FROM]="'BD Commerce <no-reply@$BASE_DOMAIN>'"
)

umask 077
: >"$OUT"
while IFS= read -r line; do
  key=${line%%=*}
  if [[ $line =~ ^[A-Z0-9_]+= && -n ${V[$key]+x} ]]; then
    printf '%s=%s\n' "$key" "${V[$key]}" >>"$OUT"
  else
    printf '%s\n' "$line" >>"$OUT"
  fi
done <.env.example

echo "Wrote $(pwd)/$OUT (mode 600). Mail UI login: staff / $MAIL_PASSWORD"
