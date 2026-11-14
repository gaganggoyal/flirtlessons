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
| Redirect `/index.html` and `/<page>/index.html` to the clean URL (removes duplicate URLs) | `deploy/Caddyfile` | **Applied 2026-11-14** |
| Long cache for `challenge.js` (it is content-hashed like the others) | `deploy/Caddyfile` | **Applied 2026-11-14** |
| Funnel-events endpoint `/e` with an IP-free log | `deploy/Caddyfile`, `docker-compose.yml` | **Applied 2026-11-14** (`docs/measurement.md`) |
| `http://www.flirtlessons.com` → `https://flirtlessons.com` in one hop (today it takes two) | shared edge Caddyfile | Proposed. Add a block `http://www.flirtlessons.com { redir https://flirtlessons.com{uri} permanent }`, validate, reload. Low impact. |
| IPv6 (AAAA record) | DNS | **Don't add yet.** The server has an IPv6 address, but outbound IPv6 failed in testing; publishing AAAA before IPv6 works would break IPv6-only visitors. |

## Apply the container changes (after approval)

```sh
scp deploy/Caddyfile user@server:/tmp/Caddyfile.new
ssh user@server '
  docker run --rm -v /tmp/Caddyfile.new:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile &&
  cp -p /root/flirtlessons/Caddyfile /root/flirtlessons/Caddyfile.bak-$(date +%Y%m%d%H%M) &&
  cat /tmp/Caddyfile.new > /root/flirtlessons/Caddyfile &&
  docker restart flirtlessons-web'
```

Rollback: copy the `.bak-*` file back the same way (`cat backup > Caddyfile`) and restart the container.
