# Test deployment on your own PC

This runs the whole shop on one Linux PC at your home or office. The PC has a public static IP
address, your domain points straight at it, and your router passes web traffic (ports 80 and 443)
to the PC. HTTPS certificates are fetched automatically. This is a **test deployment**
(staging mode): real SMS is not sent yet, and every SMS code goes to a private mail page for you
(see step 4).

Commands below are run in a terminal, from the repository folder (for example `~/bd-commerce`).

---

## 1. What runs where

```
 visitor browser
       |  HTTPS (free Let's Encrypt certificate, renewed automatically)
 your domain (DNS A records)  -->  your static IP
       |
 router: port 80 and 443 forwarded to the PC
       |
 web (Caddy, on your PC, ports 8088 / 8443 by default)
                  |-- apex / www  --> shop      (:3100)
                  |-- admin.      --> admin SPA, /v1/* --> api (:4000)
                  |-- sr.         --> portal SPA,  /v1/* --> api
                  |-- api.        --> api        (memo links, courier webhooks)
                  |-- img.        --> imgproxy   (:8080) --> garage (S3)
                  |-- mail.       --> mailpit    (:8025), basic-auth locked

 Inside Podman only: postgres, redis, garage, mailpit, api, shop, imgproxy.
 Only Caddy is published (ports 8088 and 8443). Without a domain it listens on this PC only.
```

---

## 2. Prepare the PC

You need:

- **Linux** (any recent distribution) with a user account that is not root.
- **Podman** and **podman-compose** (`podman compose` must work). Check: `podman compose version`.
- **git**.
- **At least 40 GB free disk** (images, database, product photos, backups). Check: `df -h ~`.
- **Node.js is not needed.** Everything is built inside containers.
- A **UPS** (battery backup) is strongly advised. A power cut during a database write can
  damage data, and the restore drill in step 6 is your only recovery.

Keep the PC awake. Turn off automatic suspend in your desktop settings, or on a server-style
install run `sudo systemctl mask sleep.target suspend.target`.

Let your containers and timers keep running after you log out:

```bash
sudo loginctl enable-linger "$USER"
```

Clone the repository:

```bash
git clone https://github.com/Ijaj/bd-commerce.git ~/bd-commerce
cd ~/bd-commerce
```

---

## 3. Domain, DNS and router

You need a domain name (for example `yourshop.com`) and your PC's **public static IP** (ask your
internet provider if you are not sure). The shop works with `bdc.localhost` until then, but no
outside visitor can reach it.

1. **Buy the domain** at any registrar.
2. **Add DNS A records** in the registrar's DNS page. All seven point at the same static IP
   (for example `203.0.113.10`):

   | Name (host) | Type | Value     | Who uses it                   |
   |-------------|------|-----------|-------------------------------|
   | `@`         | A    | static IP | the shop (apex)               |
   | `www`       | A    | static IP | redirects to the apex         |
   | `admin`     | A    | static IP | staff admin panel             |
   | `sr`        | A    | static IP | sales-rep portal              |
   | `img`       | A    | static IP | product images                |
   | `api`       | A    | static IP | API (links, courier webhooks) |
   | `mail`      | A    | static IP | private SMS/mail viewer       |

   Caddy inside the stack sends each name to the right service. DNS changes can take from a few
   minutes to a few hours. Check from any PC: `dig +short admin.yourshop.com` must print your IP.
3. **Forward two ports on your router** to this PC (use a fixed LAN address for the PC, set in
   the router's DHCP reservation):

   | External port | Goes to PC port | Meaning |
   |---------------|-----------------|---------|
   | 80 (TCP)      | 8088 (`HTTP_PORT`)  | web, and certificate checks |
   | 443 (TCP)     | 8443 (`HTTPS_PORT`) | secure web                  |

   Rootless Podman cannot use ports below 1024 by default, which is why the PC ports are 8088
   and 8443. If you prefer to forward 80 to 80 and 443 to 443, run
   `sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80` (add the line
   `net.ipv4.ip_unprivileged_port_start=80` to a file in `/etc/sysctl.d/` to keep it after a
   reboot) and set `HTTP_PORT=80`, `HTTPS_PORT=443` in `.env`.
4. **Allow the two ports in the PC firewall** (only if you run one):

   ```bash
   # firewalld
   sudo firewall-cmd --permanent --add-port=8088/tcp --add-port=8443/tcp --add-port=8443/udp
   sudo firewall-cmd --reload
   # ufw
   sudo ufw allow 8088/tcp && sudo ufw allow 8443
   ```

   Use 80 and 443 instead if you changed the ports as described above.
5. In `.env` (step 4) you will set `BASE_DOMAIN`, `PUBLIC_SCHEME=https`, `HTTP_BIND=0.0.0.0` and
   `ACME_EMAIL`. **Certificates come automatically** the first time the stack starts, once the DNS
   records point at your IP and the router forwards the ports. Nothing to install or renew.

**Test from outside.** Your own Wi-Fi often cannot open your own public address (router
"hairpin NAT" limits). Test from a **phone on mobile data with Wi-Fi turned off**: open
`https://yourshop.com`. It must show the shop with a padlock. Then try `https://admin.yourshop.com`.

---

## 4. First boot

Run these from `~/bd-commerce/infra/prod`.

**a) Create the secrets file.** Set your domain (use `https` after you have a domain):

```bash
cd ~/bd-commerce/infra/prod
BASE_DOMAIN=yourshop.com PUBLIC_SCHEME=https ./gen-secrets.sh
```

Without a domain, use `BASE_DOMAIN=bdc.localhost PUBLIC_SCHEME=http ./gen-secrets.sh`.

It writes `infra/prod/.env` (readable only by you) and prints the login for the mail page
(user `staff` and a password). Write that password down: it is also stored in `.env` as
`MAIL_UI_PASSWORD`. The script refuses to overwrite an existing `.env`.

**b) Edit `infra/prod/.env`.** Check these lines:

- `BASE_DOMAIN` (for example `yourshop.com`, no `https://`, no trailing slash)
- `PUBLIC_SCHEME` (`https` with a domain, `http` for `bdc.localhost`)
- `HTTP_BIND=0.0.0.0` (so the router can reach the PC's ports; leave `127.0.0.1` for local testing)
- `HTTP_PORT` and `HTTPS_PORT` (add them if missing; defaults 8088 and 8443, see step 3)
- `ACME_EMAIL` (your email: Let's Encrypt sends certificate expiry warnings there)
- `MAIL_FROM` (the sender name and address on emails)

Leave the other secrets alone. Optional courier keys (Steadfast, Pathao) can stay empty.

**c) Build and start the containers** (building the images takes a while on first run):

```bash
./deploy.sh --no-pull
```

With a domain, the first start also fetches the HTTPS certificates. If the deploy script warns
that the site did not answer yet, check DNS and the router (step 3) and read the web log
(see step 7).

**d) Run the one-time setup:**

```bash
./init.sh
```

This sets up file storage (buckets), loads the static pages, and turns on the relaxed alpha
limits for guest checkout. It can be run again safely.

**e) Create the first owner account:**

```bash
podman compose -f compose.yaml run --rm -T --no-deps api cli create-owner you@example.com "Your Name"
```

Run it from `infra/prod`. It prints a **temporary password**. Save it somewhere safe for the
next minute; you change it at first sign-in.

**f) Open the admin panel:** `https://admin.yourshop.com` (or `http://admin.bdc.localhost:8088`).
Sign in with the owner email and temporary password, then set up **2FA** (an authenticator app
on your phone). Then change the password.

**Where SMS codes appear (staging).** While SMS is not connected (`SMS_PROVIDER=dev`), the app
runs in staging mode: it sends SMS texts (customer login codes, order codes) to the private
mail viewer instead. Open `https://mail.yourshop.com`, sign in as user `staff` with the password
from step (a), and read the codes there. Do not share that page: it shows live codes.

---

## 5. Updating

When new code is published to the repository:

```bash
cd ~/bd-commerce/infra/prod
./deploy.sh
```

It pulls the latest code, rebuilds the three images, restarts the stack and runs a health check.
Your data (database, files, secrets) is kept.

---

## 6. Backups

**Make a backup by hand:**

```bash
cd ~/bd-commerce/infra/prod
./backup.sh
```

Backups are written to a folder that the script prints. It keeps the last 14 nightly ones.

**Turn on the nightly timer:**

```bash
cp ~/bd-commerce/infra/prod/systemd/* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now bdc-backup.timer
systemctl --user list-timers bdc-backup.timer
```

**Copy backups to another PC.** Not automated yet (a later step). Copy the backup folder with
`scp` or a USB stick, at least weekly. Also copy `infra/prod/.env` to a safe place (a password
manager or an encrypted USB stick). Backups do not include `.env`. Without it you cannot read
the two-factor (2FA) keys or saved payout details.

**Restore** (replaces the current data; the stack is stopped first):

```bash
cd ~/bd-commerce/infra/prod
./restore.sh /path/to/backup-folder --yes
```

**Monthly restore drill (10 minutes).** On the first Sunday of each month: take a fresh backup,
restore it, and check that you can sign in to the admin panel and see yesterday's orders. Write
the date in your own notes. If the drill fails, fix it before you trust the backups.

---

## 7. Troubleshooting

**Logs** (follow one service, Ctrl+C to stop):

```bash
cd ~/bd-commerce/infra/prod
podman compose logs -f api
podman compose logs --tail=200 shop web
```

**Stack status:**

```bash
podman compose ps
curl -skf --resolve api.yourshop.com:8443:127.0.0.1 https://api.yourshop.com:8443/health && echo API OK
```

Use your own domain. Without a domain: `curl -sf http://api.bdc.localhost:8088/health`.

**The site does not open from outside, or the browser warns about the certificate.** Check in
this order: (1) `dig +short yourshop.com` prints your static IP; (2) the router forwards 80 and
443 to the PC ports in `.env`; (3) the PC firewall allows them; (4) `.env` has
`HTTP_BIND=0.0.0.0` and `PUBLIC_SCHEME=https`; (5) the web log, which shows the certificate
attempts:

```bash
podman compose logs --tail=100 web
```

Let's Encrypt allows only a few failed attempts per hour, so fix DNS and ports first, then run
`podman compose -f compose.yaml restart web`.

**`podman exec` fails with `oom_score_adj: Permission denied`.** This is a known problem with
some rootless Podman versions. Run the command in a helper container that shares the
container's network and files instead:

```bash
podman run --rm --network container:bdc-prod-api-1 --volumes-from bdc-prod-api-1 \
  "$(podman inspect -f '{{.ImageName}}' bdc-prod-api-1)" <command>
```

Replace `<command>` with what you wanted to run, and the container name if yours differs
(`podman ps --format '{{.Names}}'`).

**Disk full.** Check, then clean old images (never use `podman volume prune`: it can delete data):

```bash
df -h ~
podman system df
podman image prune -f
```

Backups and the database grow over time. Keep at least 10 GB free.

**Changing the domain later.**

1. Edit `infra/prod/.env`: set `BASE_DOMAIN` and `PUBLIC_SCHEME=https`.
2. Run `./deploy.sh`. The shop and admin read the domain when they are built, so they must be
   rebuilt.
3. At the registrar, add the seven A records for the new domain (step 3). Check them with `dig`.
4. Check the admin panel loads at the new address. Run `./deploy.sh` only after DNS points here:
   the certificates are fetched when the web container starts.

Old links to the previous domain will stop working. Tell your customers.
