# Hosting

The site is served by a small Caddy container, `flirtlessons-web`, on the VPS:

- `docker-compose.yml` and `Caddyfile` here are the versioned copies of `/root/flirtlessons/` on the server.
- Static files: `/var/www/flirtlessons` (read-only mount). `./deploy.sh` updates them; no restart needed.
- TLS, `www` → apex redirects and security headers (CSP, HSTS, etc.) are handled by the shared edge
  Caddy that fronts every site on the server. That file is **not** part of this repo.
- `admin off` is set, so after changing the Caddyfile run `docker restart flirtlessons-web`
  (edit the file in place; the container bind-mounts that exact file).

## Server changes

| Change | Where | Status |
|---|---|---|
| Redirect `/index.html` and `/<page>/index.html` to the clean URL (removes duplicate URLs) | `deploy/Caddyfile` | Ready, **not applied yet** (tested in a throwaway container on 14 Nov 2026) |
| Long cache for `challenge.js` and `quiz.js` (content-hashed like the others) | `deploy/Caddyfile` | Ready, **not applied yet** |
| Direct requests for `/404.html` return 404 instead of 200 | `deploy/Caddyfile` | Ready, **not applied and not yet tested**: check it in the throwaway container step below |
| Funnel-events endpoint `/e` with an IP-free log | `deploy/Caddyfile`, `docker-compose.yml` | Ready, **not applied yet** (tested in a throwaway container; `docs/measurement.md`) |
| `http://www.flirtlessons.com` → `https://flirtlessons.com` in one hop (today it takes two) | shared edge Caddyfile | Proposed. Add a block `http://www.flirtlessons.com { redir https://flirtlessons.com{uri} permanent }`, validate, reload. Low impact. |
| IPv6 (AAAA record) | DNS | **Don't add yet.** The server has an IPv6 address, but outbound IPv6 failed in testing; publishing AAAA before IPv6 works would break IPv6-only visitors. |

## Apply the container changes (after approval)

1. Test the new config against the live files in a throwaway container (production untouched):

```sh
scp deploy/Caddyfile user@server:/tmp/Caddyfile.new
ssh user@server '
  docker run --rm -v /tmp/Caddyfile.new:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile &&
  mkdir -p /tmp/fltest-logs &&
  docker run -d --rm --name fltest -p 127.0.0.1:18080:80 -v /tmp/Caddyfile.new:/etc/caddy/Caddyfile:ro \
    -v /var/www/flirtlessons:/srv:ro -v /tmp/fltest-logs:/logs caddy:2-alpine && sleep 2 &&
  for u in / /rizz-test/ /index.html /legal.html /404.html /nope/; do
    curl -s -o /dev/null -w "%{http_code} $u\n" http://127.0.0.1:18080$u; done &&
  docker stop fltest'
```

   Expect `200 /`, `200 /rizz-test/`, `301 /index.html`, `301 /legal.html`, `404 /404.html`, `404 /nope/`.

2. Back up, write in place (keeps the bind-mounted inode), add the log folder and recreate the container
   so it picks up the new `./logs` volume:

```sh
scp deploy/docker-compose.yml user@server:/tmp/docker-compose.yml.new
ssh user@server '
  cd /root/flirtlessons &&
  cp -p Caddyfile Caddyfile.bak-$(date +%Y%m%d%H%M) && cp -p docker-compose.yml docker-compose.yml.bak-$(date +%Y%m%d%H%M) &&
  cat /tmp/Caddyfile.new > Caddyfile && cat /tmp/docker-compose.yml.new > docker-compose.yml &&
  mkdir -p logs && docker compose up -d'
```

Rollback: copy the `.bak-*` file back the same way (`cat backup > Caddyfile`) and restart the container.
