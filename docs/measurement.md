# Measurement: funnel events

Status: **built but switched off.** Turning it on changes the privacy promise on
`/legal/`, so it needs the owner's approval (see "Enabling" below).

## Design

- **First-party and cookieless.** The browser sends `navigator.sendBeacon('/e?n=<event>&…')`
  to our own server. No cookies, no local storage, no third parties, no fingerprinting.
- **No identifiers.** There is no user, session or device ID. Rates are ratios of event counts.
- **No content.** Never replies, free text, names or URLs with personal data. Allowed fields:

| Field | Meaning | Example |
|---|---|---|
| `n` | event name | `challenge_complete` |
| `p` | page path | `/rizz-test/` |
| `src` | `utm_source`, else referrer hostname, else `direct` | `whatsapp`, `instagram.com` |
| `scn` | scenario id | `chai-momo-v1` |
| `sb` | score bucket (10-point bands) | `60-69` |
| `ref` | `beat` when the visitor arrived via a friend's challenge link | `beat` |
| `via` | share channel | `native`, `whatsapp`, `x`, `copy` |

- **No IPs or headers in the log.** The site container sits behind the edge proxy and never
  receives a trusted client IP; the Caddy log filter also deletes host, IP and header fields,
  so each line holds only a timestamp, the method, status and the `/e?...` URI. Verified in a
  throwaway container: a request carrying `X-Forwarded-For` and a custom `User-Agent` left
  neither in the log, and ordinary page requests were not logged at all.

## Events

| Event | Fires when | Dedupe |
|---|---|---|
| `landing_view` | any page loads | once per page load |
| `challenge_start` | "Start the challenge" clicked | once per page load (retries don't recount) |
| `challenge_complete` | result shown after message 3 | once per attempt |
| `result_share` | first share action on a result (any channel) | once per attempt |
| `result_share_click` | every share click, with `via` | none (diagnostics only) |
| `result_share_complete` | native share sheet reports success | per success |
| `result_card_download` | result card downloaded | per click |
| `referred_visit` | challenge page opened with `?beat=` | once per page load |
| `referred_completion` | a referred visitor completes | once per page load |

`signup` and `purchase` from the brief are **not implemented**: the site has no accounts or payments.

**Share click ≠ verified share.** WhatsApp, X and copy-link can't report whether a message was
actually sent. Only `result_share_complete` (native share sheet) confirms a share, and only on
platforms that report it. `referred_visit` is the reliable downstream signal.

## Dashboard

`python3 tools/events_report.py events.log [--since YYYY-MM-DD]` prints:

- **Core funnel:** `landing_view (/rizz-test/) → challenge_start → challenge_complete → result_share → referred_visit → referred_completion`, with step-to-step rates
- **Referral multiplier** = share rate among completers × new visitors per sharer × completion rate among referred visitors
  (= `result_share/challenge_complete × referred_visit/result_share × referred_completion/referred_visit`).
  This estimates new completed challenges per completion. It is not a forecast, and with no IDs it
  assumes the counts describe comparable cohorts.
- Share clicks by channel, card downloads, score distribution, landings and starts by source, top pages
- A small-sample warning whenever a key count is below 30

Diagnostic map (from the brief):

| Pattern | Look at |
|---|---|
| Views but few visits | the hook and call to action in the post itself |
| Visits but few starts | clarity of the intro card, load time, the Start button |
| Starts but few completions | length, waiting time between messages, errors |
| Completions but few shares | whether the result is fun enough to show off |
| Shares but few referred starts | the link preview and the `?beat=` landing |

**Cost:** the challenge uses no AI, so the marginal cost per completed session is zero. Hosting is
the existing fixed-cost VPS. Analytics adds a small log file (rotated at 10 MB, 10 files kept).

**Known limits:** reloading a referred link counts a second `referred_visit`; ad blockers may block
`/e`; bots that run JavaScript can inflate `landing_view`. Report absolute counts next to every rate.

## Enabling (owner approval required)

1. Approve the change to the privacy policy below.
2. `build.py`: set `ANALYTICS_ENABLED = True`.
3. `deploy/Caddyfile`: uncomment the funnel-events block. `deploy/docker-compose.yml`: add `- ./logs:/logs` under volumes.
4. Copy both to `/root/flirtlessons/`, run `docker compose up -d` there, then `./deploy.sh`.
5. Check: `curl -X POST "https://flirtlessons.com/e?n=landing_view&p=%2F"` returns 204 and appears in `/root/flirtlessons/logs/events.log`.

Rollback: set the flag back to `False`, re-comment the block, redeploy. The log file can be deleted at any time.

### Proposed privacy policy text (replaces the "No accounts, no forms, no tracking" bullet)

> **Anonymous usage counts, no tracking.** We do not use cookies, analytics services, advertising
> or tracking pixels. To understand which lessons and tools are useful, pages send a simple
> anonymous count to our own server, for example "challenge completed, score 60–69, arrived from
> WhatsApp". These counts contain no IP address, no device identifier and nothing you type or
> choose, and they can't be linked to you or to each other.
