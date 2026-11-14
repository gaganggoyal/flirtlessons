#!/usr/bin/env python3
"""Funnel report for the 3-message challenge, from the cookieless event log.

    python3 tools/events_report.py events.log [--since 2026-11-15] [--scn chai-momo-v1]

Copy the log from the server first (it only exists once events are enabled), e.g.
    scp user@server:/root/flirtlessons/logs/events.log .

Each log line is Caddy JSON; the event is in the request URI: /e?n=<event>&p=<path>&src=<source>&...
There are no visitor identifiers by design, so all rates are ratios of event counts
(see docs/measurement.md for definitions and their limits).
"""
import argparse
import datetime
import json
import sys
from collections import Counter, defaultdict
from urllib.parse import parse_qs, urlsplit

FUNNEL = ["landing_view", "challenge_start", "challenge_complete", "result_share",
          "referred_visit", "referred_completion"]
SMALL_SAMPLE = 30


def parse(lines, since=None, scn=None):
    events = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
            uri = rec["request"]["uri"]
        except (ValueError, KeyError):
            continue
        parts = urlsplit(uri)
        if parts.path != "/e":
            continue
        q = {k: v[0] for k, v in parse_qs(parts.query).items()}
        if "n" not in q:
            continue
        day = datetime.datetime.fromtimestamp(rec.get("ts", 0), datetime.timezone.utc).date()
        if since and day < since:
            continue
        if scn and q.get("scn") not in (scn, None) and q["n"] != "landing_view":
            continue
        q["day"] = day.isoformat()
        events.append(q)
    return events


def ratio(a, b):
    return a / b if b else None


def fmt(r):
    return "n/a" if r is None else f"{r:.0%}" if r <= 10 else f"{r:.2f}"


def report(events, out=sys.stdout):
    n = Counter(e["n"] for e in events)
    landing = sum(1 for e in events if e["n"] == "landing_view" and e.get("p") == "/rizz-test/")
    counts = {"landing_view": landing, **{k: n[k] for k in FUNNEL[1:]}}

    w = out.write
    w("Core funnel (challenge page)\n")
    prev = None
    for step in FUNNEL:
        c = counts[step]
        rate = f"  ({fmt(ratio(c, counts[prev]))} of {prev})" if prev else ""
        w(f"  {step:<22} {c:>7}{rate}\n")
        prev = step

    share_rate = ratio(counts["result_share"], counts["challenge_complete"])
    visitors_per_sharer = ratio(counts["referred_visit"], counts["result_share"])
    referred_completion_rate = ratio(counts["referred_completion"], counts["referred_visit"])
    parts = [share_rate, visitors_per_sharer, referred_completion_rate]
    multiplier = None if None in parts else share_rate * visitors_per_sharer * referred_completion_rate
    w("\nReferral multiplier = share rate × new visitors per sharer × referred completion rate\n")
    w(f"  = {fmt(share_rate)} × {fmt(visitors_per_sharer)} × {fmt(referred_completion_rate)}"
      f" = {'n/a' if multiplier is None else f'{multiplier:.2f}'}\n")
    w("  (new completed challenges generated per completion; an estimate, not a forecast)\n")

    w("\nShare clicks by channel (every click, diagnostics only)\n")
    by_via = Counter(e.get("via", "?") for e in events if e["n"] == "result_share_click")
    for via, c in by_via.most_common():
        w(f"  {via:<10} {c}\n")
    w(f"  card downloads: {n['result_card_download']}   native share completed: {n['result_share_complete']}\n")

    w("\nScore buckets (completions)\n")
    for b, c in sorted(Counter(e.get("sb", "?") for e in events if e["n"] == "challenge_complete").items(),
                       key=lambda kv: int(kv[0].split("-")[0]) if kv[0][0].isdigit() else -1):
        w(f"  {b:<8} {c}\n")

    w("\nChallenge landings and starts by source\n")
    by_src = defaultdict(Counter)
    for e in events:
        if (e["n"] == "landing_view" and e.get("p") == "/rizz-test/") or e["n"] == "challenge_start":
            by_src[e.get("src", "?")][e["n"]] += 1
    for src, c in sorted(by_src.items(), key=lambda kv: -kv[1]["landing_view"]):
        w(f"  {src:<24} landings {c['landing_view']:>5}   starts {c['challenge_start']:>5}\n")

    w("\nSite-wide page views by path\n")
    for path, c in Counter(e.get("p", "?") for e in events if e["n"] == "landing_view").most_common(12):
        w(f"  {path:<40} {c}\n")

    small = [k for k in ("challenge_complete", "result_share", "referred_visit") if 0 < counts[k] < SMALL_SAMPLE]
    if small:
        w(f"\nCaution: small samples (<{SMALL_SAMPLE}) for {', '.join(small)}; treat rates as noise.\n")
    w("\nAI cost per completed session: 0 (the challenge uses no AI). Hosting cost is fixed.\n")
    return counts, multiplier


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("logs", nargs="+")
    ap.add_argument("--since", type=datetime.date.fromisoformat)
    ap.add_argument("--scn")
    a = ap.parse_args()
    lines = []
    for path in a.logs:
        with open(path, encoding="utf-8") as f:
            lines += f.readlines()
    report(parse(lines, a.since, a.scn))


if __name__ == "__main__":
    main()
