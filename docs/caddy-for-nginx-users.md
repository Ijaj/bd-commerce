# Caddy for nginx users

This guide explains the edge web server in our production stack. You know nginx. This
guide maps what you know onto Caddy, walks through our real config, and lists the commands
you will use every day.

The real files:

- `infra/prod/Caddyfile`: the config (84 lines). Every snippet below is copied from it.
- `infra/prod/compose.yaml`: the `web:` service runs Caddy.
- `docs/deploy.md`: DNS, router and first boot (section 3), troubleshooting (section 7).

Run all commands from `infra/prod` unless a line says otherwise.

---

## 1. Mental model

Caddy does the same job as nginx: it listens on ports 80 and 443, terminates TLS, serves
static files and forwards requests to other containers. The words are different.

| nginx | Caddy | Notes |
|-------|-------|-------|
| `nginx.conf` plus `conf.d/*.conf` | one file, `Caddyfile` | Ours is `infra/prod/Caddyfile`. |
| `server { }` block | site block: `example.com { }` | The first line is the site address. |
| `location /x { }` | `handle /x/* { }` or `handle_path /x/* { }` | See the note on `handle` below. |
| `proxy_pass` | `reverse_proxy` | Also handles websockets and retries. |
| `root` plus `try_files` plus `index` | `root * /srv/x`, `try_files {path} /index.html`, `file_server` | Three lines instead of one block. |
| `add_header` | `header` | `header +X` adds, `header -X` removes. |
| `return 301` / `rewrite ... redirect` | `redir` | `redir <url> permanent` sends 301. |
| `auth_basic` | `basic_auth` | Caddy takes a bcrypt hash, not an htpasswd file. |
| `gzip on` | `encode zstd gzip` | Lists the compression types it may use. |
| `set_real_ip_from` | `trusted_proxies` | Global option, in the `servers` block. |
| `client_max_body_size` | `request_body { max_size ... }` | |
| certbot and renewal cron | automatic HTTPS | No extra tool. See section 4. |
| `nginx -t` | `caddy validate` | |
| `nginx -s reload` | `caddy reload` | Does NOT work for us. See section 5. |
| `error_log` / `access_log` | `log` | Access logs are off unless a site has `log`. |

**Handle blocks.** Inside one site, `handle` blocks are mutually exclusive. Caddy checks
the more specific path first, so `/v1/*` wins over the catch-all `handle { }` with no
matcher. Only one `handle` runs per request. This is like nginx `location` matching,
but simpler.

**Directive order.** In nginx, order in the file often matters. In Caddy, the order of
directives inside a block is fixed by Caddy itself, not by where you write them. You
do not need to sort them. If you need a strict order, use `route { }`. Our config does not
use `route`.

**Environment and syntax.** Caddy files look like nginx but with no semicolons. Braces
open and close blocks. Each directive is on its own line.

---

## 2. Our Caddyfile, block by block

### 2.1 Global options

Real config (lines 5-16):

```caddy
{
	admin off
	# Let's Encrypt contact: compose turns ACME_EMAIL into the line "email <address>", or leaves it
	# empty when ACME_EMAIL is not set (Caddy rejects an `email` directive with no address).
	{$ACME_EMAIL_LINE}
	servers {
		# Only peers in private ranges (the compose subnet) may set X-Forwarded-For; direct
		# visitors are identified by their socket address.
		trusted_proxies static private_ranges
		client_ip_headers X-Forwarded-For
	}
}
```

nginx equivalent (there is no single block in nginx; these are the nearest settings):

```nginx
# no admin API in nginx
# no email setting: certbot takes its email on the command line
set_real_ip_from 10.0.0.0/8;     # roughly, trusted proxies
real_ip_header X-Forwarded-For;
```

What differs:

- A global block with no site address is Caddy's place for settings that apply to
  every site. It must be the first thing in the file.
- `admin off` turns off Caddy's control API. By default Caddy listens on
  `localhost:2019` and accepts config changes. With `admin off`, nothing can change the
  running config except a restart. This is also why `caddy reload` fails (section 5).
- `{$ACME_EMAIL_LINE}` is an environment placeholder. Compose fills it with `email you@x`
  or leaves it empty. See section 3.
- `trusted_proxies static private_ranges` says: trust `X-Forwarded-For` only when the
  request comes from a private IP range. `static` is the module that takes a fixed list,
  and `private_ranges` is the list of private addresses. `client_ip_headers` says which
  header carries the visitor's IP.

### 2.2 Health check on :8081

Real config (lines 18-22):

```caddy
# Compose healthcheck only (container-internal port, not published).
:8081 {
	respond /healthz "ok" 200
	respond 404
}
```

nginx equivalent:

```nginx
server {
    listen 8081;
    location = /healthz { return 200 "ok"; }
    location / { return 404; }
}
```

What differs: a site address with no host name (`:8081`) means "listen on port 8081 for
any host". `respond` sends a fixed answer. Nothing is proxied. Port 8081 is not published
to the PC, only the compose healthcheck uses it (`compose.yaml`, `healthcheck:`).

### 2.3 Storefront and the www redirect

Real config (lines 24-32):

```caddy
# Storefront (Next.js)
{$PUBLIC_SCHEME:https}://{$BASE_DOMAIN} {
	encode zstd gzip
	reverse_proxy shop:3100
}

{$PUBLIC_SCHEME:https}://www.{$BASE_DOMAIN} {
	redir {$PUBLIC_SCHEME:https}://{$BASE_DOMAIN}{uri} permanent
}
```

nginx equivalent:

```nginx
server {
    # listen 443 ssl; certificate lines omitted
    server_name example.com;
    gzip on;
    location / { proxy_pass http://shop:3100; }
}
server {
    # listen 443 ssl; certificate lines omitted
    server_name www.example.com;
    return 301 https://example.com$request_uri;
}
```

What differs:

- The site address is a full URL. `https://example.com` means HTTPS only, and Caddy gets a
  certificate for it. A bare `example.com` also works, but spelling the scheme makes
  the intent clear.
- `{$PUBLIC_SCHEME:https}` is replaced at parse time. Local tests use `http`.
- `{uri}` is a runtime placeholder. It keeps the path and query, like `$request_uri`.
  See section 3 for the difference between `{$VAR}` and `{uri}`.
- `permanent` makes the redirect a 301.
- `encode zstd gzip` replaces `gzip on`. Caddy picks zstd when the browser accepts it.
- `reverse_proxy shop:3100` uses the compose service name. Inside the stack, `shop` is
  a host name. You never write an IP address.

### 2.4 Admin SPA

Real config (lines 34-49):

```caddy
# Admin SPA: /v1/* goes to the API (same-origin), everything else is the SPA.
{$PUBLIC_SCHEME:https}://admin.{$BASE_DOMAIN} {
	encode zstd gzip
	handle /v1/* {
		reverse_proxy api:4000
	}
	handle {
		root * /srv/admin
		@assets path /assets/*
		header @assets Cache-Control "public, max-age=31536000, immutable"
		@shell not path /assets/*
		header @shell Cache-Control "no-cache"
		try_files {path} /index.html
		file_server
	}
}
```

nginx equivalent:

```nginx
server {
    # listen 443 ssl; certificate lines omitted
    server_name admin.example.com;
    gzip on;

    location /v1/ {
        proxy_pass http://api:4000;
    }

    root /srv/admin;
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri /index.html;
    }
}
```

What differs:

- `handle /v1/*` is the API path. Because it is in the same site, the browser sends
  requests to the same origin. No CORS is needed.
- The second `handle` (no matcher) is the catch-all. It catches everything else.
- `root * /srv/admin` sets the folder. The `*` means "all paths under this site".
  Admin files are baked into the image (`infra/prod/web.Containerfile`), so a change to
  them needs `./deploy.sh`, not a restart.
- `@assets path /assets/*` is a named matcher. nginx has no named matcher. You write
  the path test once and use it on the next line with `@assets`.
- `header @assets ...` sets the cache header only for matching requests. Built files in
  `/assets/` have hashed names, so they can be cached for a year.
- `@shell not path /assets/*` is the opposite. `index.html` is never cached.
- `try_files {path} /index.html` tries the real file first, then falls back to
  `index.html`. This is the SPA rule. `{path}` is the request path. It is a runtime
  placeholder.
- `file_server` does the actual file serving. nginx does this on its own. Caddy needs the
  directive, so write it.

### 2.5 SR (sales-rep) portal

Real config (lines 51-66):

```caddy
# SR / B2B portal SPA
{$PUBLIC_SCHEME:https}://sr.{$BASE_DOMAIN} {
	encode zstd gzip
	handle /v1/* {
		reverse_proxy api:4000
	}
	handle {
		root * /srv/portal
		@assets path /assets/*
		header @assets Cache-Control "public, max-age=31536000, immutable"
		@shell not path /assets/*
		header @shell Cache-Control "no-cache"
		try_files {path} /index.html
		file_server
	}
}
```

The same pattern as the admin site, with a different host and folder (`/srv/portal`).
In nginx you would copy the admin server block and change two lines. Caddy works the
same way. Copy-paste is normal here.

### 2.6 Signed image URLs

Real config (lines 68-71):

```caddy
# Signed image URLs (imgproxy reads the Garage bucket)
{$PUBLIC_SCHEME:https}://img.{$BASE_DOMAIN} {
	reverse_proxy imgproxy:8080
}
```

nginx equivalent: a `server` block with `proxy_pass http://imgproxy:8080;`.

What differs: nothing important. Caching and signing happen in imgproxy, not in Caddy.
We do not set `encode` here because images are already compressed.

### 2.7 Public API

Real config (lines 73-76):

```caddy
# Public API: SR memo share links, courier webhooks
{$PUBLIC_SCHEME:https}://api.{$BASE_DOMAIN} {
	reverse_proxy api:4000
}
```

nginx equivalent: a `server` block with `proxy_pass http://api:4000;`.

What differs: the admin and SR sites also send `/v1/*` to the API, so the API is reachable
on three hosts. Only the public API host needs to be reachable from couriers and
share links.

### 2.8 Mailpit (private viewer)

Real config (lines 78-84):

```caddy
# Mailpit holds every OTP and notification while SMS is stubbed: never expose without auth.
{$PUBLIC_SCHEME:https}://mail.{$BASE_DOMAIN} {
	basic_auth {
		staff {$MAIL_UI_HASH}
	}
	reverse_proxy mailpit:8025
}
```

nginx equivalent:

```nginx
server {
    server_name mail.example.com;
    auth_basic "Mailpit";
    auth_basic_user_file /etc/nginx/.htpasswd;   # created with htpasswd
    location / { proxy_pass http://mailpit:8025; }
}
```

What differs:

- Caddy does not read an htpasswd file. The `basic_auth` block lists a user name and a
  bcrypt hash. Our user name is `staff`.
- `{$MAIL_UI_HASH}` is an environment placeholder. Compose reads the hash from `.env`
  (set by `gen-secrets.sh`). See section 3.
- Keep this site behind auth. Mailpit shows every OTP code.

---

## 3. Placeholders: `{$VAR}` versus `{placeholder}`

Caddy has two kinds of `{...}`. They look alike, so check which one you are reading.

| Form | Example | When it is filled | Source |
|------|---------|-------------------|--------|
| `{$NAME}` | `{$BASE_DOMAIN}` | when the Caddyfile is parsed, once, at start | environment of the Caddy process |
| `{$NAME:default}` | `{$PUBLIC_SCHEME:https}` | same, and uses `default` if the variable is empty or unset | same |
| `{name}` | `{uri}`, `{path}`, `{http.error.status_code}` | for every request | Caddy, at runtime |

This works like `envsubst`. The `{$...}` form is text replacement. The result is a plain
Caddyfile with no variables left in it.

Consequences for us:

- Values come from the `web:` service's `environment:` block in `compose.yaml`:
  `BASE_DOMAIN`, `PUBLIC_SCHEME`, `MAIL_UI_HASH`, `ACME_EMAIL_LINE`.
- Compose reads `.env` when it creates the container. A `restart` does not read it
  again. If you change `.env`, recreate the container:
  `podman compose -f compose.yaml up -d web`.
- If `ACME_EMAIL_LINE` is empty, the line in the global block is blank. That is valid.
  Caddy then gets certificates without a contact address.
- A typo in `{$NAME}` with no default becomes an empty string silently. Check with
  `caddy adapt` (section 5) if a value looks wrong.

---

## 4. Certificates (HTTPS)

### 4.1 What Caddy does for you

With `PUBLIC_SCHEME=https`, Caddy:

- gets a certificate from Let's Encrypt for every host in the file (`@`, `www`, `admin`,
  `sr`, `img`, `api`, `mail`, with your domain). You do not list them anywhere else.
- proves you own the host with the ACME HTTP-01 challenge on port 80 or the TLS-ALPN-01
  challenge on port 443. Both ports must reach the container.
- stores certificates and keys in the `caddy-data` volume, under `/data/caddy`.
- renews each certificate about 30 days before it expires. You do not need cron, a timer
  or certbot.
- staples OCSP responses, so browsers can check revocation quickly.
- redirects `http://` to `https://` for each site.

Our compose file mounts `caddy-data:/data` and `caddy-config:/config`. Keep both
volumes. The certificates live in `caddy-data`.

### 4.2 What must be true

Caddy cannot get a certificate unless:

1. DNS A records for each host point at your static IP. Check with `dig +short admin.yourshop.com`.
2. The router forwards public port 80 to PC port 8088, and public 443 to PC 8443. The
   container listens on 80 and 443 internally.
3. The PC firewall allows those ports.
4. `.env` has `PUBLIC_SCHEME=https`.

Full steps: `docs/deploy.md` section 3. Test from a phone on mobile data, not from your
Wi-Fi.

### 4.3 Rate limits: be careful

Let's Encrypt limits failed attempts and the number of certificates per domain. Each
failed attempt counts. Repeated restarts with bad DNS can block you for an hour or more.

- Fix DNS and port forwarding first. Then restart once.
- Do not delete the `caddy-data` volume to "reset" things. You lose the certificates
  you already have, and each new start asks for new ones.
- While you experiment, use the staging CA. Staging certificates are not trusted by
  browsers, but the limits are much higher. Add this line to the global block:

  ```caddy
  acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
  ```

  Remove the line before you go live, then restart the container. Staging certificates
  are kept in their own folder under `/data/caddy/certificates` (see 5.6), so the
  production certificates are not touched. Check the current limits on letsencrypt.org
  before you rely on them.

### 4.4 Where to see errors

```bash
podman compose -f compose.yaml logs --tail=100 web
```

Look for lines that mention `acme`, `challenge`, `obtain` or `certificate`. They say which
host failed and why.

---

## 5. Daily commands

All commands run from `infra/prod`.

### 5.1 Validate the Caddyfile

```bash
podman exec bdc-prod-web-1 caddy validate --config /etc/caddy/Caddyfile
```

This checks syntax and module names. It does not check that the upstream containers
exist. Run it before every restart. It is the equivalent of `nginx -t`.

### 5.2 Reload after editing: restart, do not reload

```bash
podman compose -f compose.yaml restart web
```

Why not `caddy reload`: Caddy's `reload` command talks to the admin API. Our config has
`admin off` in the global block (line 6). With the admin API off, `caddy reload` fails,
because nothing is listening to receive the new config. This is on purpose. Nothing
can change the live config without a container restart.

The Caddyfile is bind-mounted read-only from the host, so your edit is visible inside
the container at once. Caddy reads the file only at start. So a restart is what applies
the change. A restart takes a few seconds. Certificates stay in `caddy-data`, so there is
no new certificate request.

Always validate (5.1) before you restart. If the file is broken, the restart fails and the
edge stays down until you fix the file. Validate first, so you know before you restart.

### 5.3 Logs

```bash
podman compose -f compose.yaml logs -f --tail 100 web
```

Add `--tail 200` for more history. Press Ctrl+C to stop following.

### 5.4 Format the file

```bash
podman exec bdc-prod-web-1 caddy fmt --overwrite --config /etc/caddy/Caddyfile
```

`caddy fmt` fixes indentation and spacing. The Caddyfile is mounted read-only in the
container (`:ro` in `compose.yaml`), so `--overwrite` inside the container fails. Run it
on the host, where you have the `caddy` binary, then validate:

```bash
caddy fmt --overwrite infra/prod/Caddyfile
podman exec bdc-prod-web-1 caddy validate --config /etc/caddy/Caddyfile
```

### 5.5 Adapt to JSON for debugging

```bash
podman exec bdc-prod-web-1 caddy adapt --config /etc/caddy/Caddyfile --pretty
```

This prints the Caddyfile as the JSON Caddy really runs. Use it to see what a
placeholder became, or which site matched. It changes nothing.

### 5.6 List the certificates

```bash
podman exec bdc-prod-web-1 ls -R /data/caddy/certificates
```

You see one folder per certificate authority, and one folder per host under it. A file
ending in `.crt` is the certificate, and `.key` is the private key.

If `podman exec` fails with `oom_score_adj: Permission denied`, use the helper container
in `docs/deploy.md` section 7.

### 5.7 Quick curl tests

Run these on the PC. Replace `yourshop.com` with your domain.

Test HTTPS on the public port, pinned to localhost so DNS does not matter:

```bash
curl -skI --resolve admin.yourshop.com:8443:127.0.0.1 https://admin.yourshop.com:8443/
```

`-s` silences the progress, `-k` skips certificate checks (use it only for local tests),
`-I` shows headers only. Look for `HTTP/2 200` and `cache-control: no-cache`.

Test the http-to-https redirect:

```bash
curl -sI -H "Host: yourshop.com" http://127.0.0.1:8088/
```

Look for `HTTP/1.1 308` (Caddy's redirect code) and a `Location: https://...` header.

Test the health check inside the container:

```bash
podman exec bdc-prod-web-1 wget -qO- http://127.0.0.1:8081/healthz
```

It should print `ok`.

For a local test without a real domain, use `PUBLIC_SCHEME=http` and the `bdc.localhost` host:

```bash
curl -s -H "Host: admin.bdc.localhost" http://127.0.0.1:8088/
```

---

## 6. Common tasks (examples)

The snippets in this section are examples. They are NOT in our Caddyfile. Add one only
when you need it, then run `caddy validate` and restart.

### 6.1 Add a new subdomain

Add a DNS A record for the new name (section 3 of `docs/deploy.md`), then add a site block.
The example below uses a made-up `docs` service.

Caddy:

```caddy
{$PUBLIC_SCHEME:https}://docs.{$BASE_DOMAIN} {
	encode zstd gzip
	reverse_proxy docs:8080
}
```

nginx: a new `server { server_name docs.example.com; ... }` block with `proxy_pass`.

Difference: Caddy gets the certificate for the new host on its own. You do not edit a
cert list. The new service must be on the same compose network and in `depends_on` if
you want it started first.

### 6.2 Add a response header

Caddy:

```caddy
header +X-Frame-Options "SAMEORIGIN"
```

Put it inside a site block, at the same level as `encode`. The `+` adds the header.
Without `+`, the header replaces any header with that name. `-Server` removes a header.

nginx: `add_header X-Frame-Options "SAMEORIGIN" always;`

Difference: nginx `add_header` drops the header in nested blocks, so repeat it. Caddy's
`header` applies at the site level, and `handle` blocks inherit it.

### 6.3 Block a path

Caddy:

```caddy
@debug path /debug/*
handle @debug {
	respond 404
}
```

nginx:

```nginx
location /debug/ { return 404; }
```

Difference: wrap the response in `handle` so it is one of the mutually exclusive branches.
A plain `respond` with a matcher also works, but `handle` makes the order clear.

### 6.4 Raise the upload size

Caddy:

```caddy
request_body {
	max_size 50MB
}
```

nginx: `client_max_body_size 50m;`

Difference: Caddy's default is no limit. Put `request_body` inside the site block that
needs it. Only raise it for the uploads path if you can, with a matcher and `handle`.

### 6.5 Custom 404 page

Caddy:

```caddy
handle_errors {
	@notfound expression {http.error.status_code} == 404
	rewrite @notfound /404.html
	root * /srv/errors
	file_server
}
```

nginx: `error_page 404 /404.html;` plus a `location = /404.html` block.

Difference: `handle_errors` runs when another directive fails. The `{http.error.status_code}`
placeholder is runtime. The error page files must exist in the image or a mounted folder.
Test this with `caddy validate` and a real request; it is not in our config.

### 6.6 Access logs

Caddy:

```caddy
log {
	output stdout
	format console
}
```

nginx: `access_log /var/log/nginx/access.log;`

Difference: Caddy does not write access logs unless a site has a `log` directive. Our
Caddyfile has none, so `logs` shows only Caddy's own messages, such as certificate and
upstream errors. Add `log` to a site to see requests in `podman compose logs`. Remember to
restart after the change.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Browser says the certificate is not trusted, or the log shows `obtaining certificate` errors | DNS does not point at the static IP, or ports 80/443 do not reach the PC | Check `dig +short yourshop.com`, the router forwards, and the firewall. See `docs/deploy.md` section 7. Then `restart web`. |
| Certificate never appears, and the log shows rate limit errors | Too many failed attempts in a short time | Wait an hour or more. Fix DNS first. Use the staging CA while you test (section 4.3). Do not wipe `caddy-data`. |
| Redirect loop (page keeps reloading or ERR_TOO_MANY_REDIRECTS) | `PUBLIC_SCHEME` does not match how you reach the site, or another proxy in front adds its own redirect | Check `PUBLIC_SCHEME` in `.env`. We have no proxy in front, so a loop is almost always the scheme. Recreate the container after editing `.env`. |
| 502 Bad Gateway from one site | The upstream container is down, or the name or port in `reverse_proxy` is wrong | `podman compose -f compose.yaml ps`, then `logs api` (or the other service). Caddy starts even when upstream is down; the 502 appears on each request. |
| Visitor IP in the app is a private or proxy address | Requests come through the PC's port forwarding, so the source address Caddy sees is not the visitor | Our config trusts `X-Forwarded-For` only from private ranges, so outside clients cannot fake it. Check the app's own IP logic first. If it still shows a private address, the network path is the cause. Not verified in this stack. |
| Changes to the Caddyfile do not take effect | Caddy reads the file only at start, and you did not restart | `caddy validate`, then `podman compose -f compose.yaml restart web`. |
| Changed `.env` values (domain, hash) do not take effect | `restart` does not reread `.env` | `podman compose -f compose.yaml up -d web` to recreate the container. |
| Admin or SR screens show old code after a change | The SPA files are baked into the image | Run `./deploy.sh`. A restart is not enough. |
| `caddy reload` fails with an admin API error | `admin off` is set in our global block | Use `podman compose -f compose.yaml restart web`. |
| `address already in use` in the log, or the container will not start | Another process already uses 80, 443, 8088 or 8443 | Find it: `ss -ltnp | grep -E ':(80|443|8088|8443) '`. Stop the old process. Do not use `pkill -f` with a broad pattern. |
| `caddy validate` says unknown directive or bad syntax | A typo, a missing brace, or a directive from a newer Caddy version | Read the line number in the error. Compare with `caddy adapt` output. |

---

## 8. Links

- Caddyfile syntax: https://caddyserver.com/docs/caddyfile
- Directives reference: https://caddyserver.com/docs/caddyfile/directives
- Automatic HTTPS: https://caddyserver.com/docs/automatic-https
- Our deploy guide: `docs/deploy.md` (section 3 for DNS and router, section 7 for troubleshooting)
- Our config: `infra/prod/Caddyfile`
- The compose service: `infra/prod/compose.yaml`, `web:` block
