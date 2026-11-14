"""Run: python3 -m unittest discover -s tests"""
import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import events_report as er  # noqa: E402


def line(uri, ts=1794700000):
    return json.dumps({"ts": ts, "request": {"method": "POST", "uri": uri}, "status": 204})


class EventsReportTest(unittest.TestCase):
    def sample(self):
        L = []
        L += [line("/e?n=landing_view&p=%2Frizz-test%2F&src=direct")] * 40
        L += [line("/e?n=landing_view&p=%2F&src=direct")] * 15            # not the challenge page
        L += [line("/e?n=challenge_start&scn=chai-momo-v1&p=%2Frizz-test%2F&src=direct")] * 30
        L += [line("/e?n=challenge_complete&scn=chai-momo-v1&sb=60-69")] * 20
        L += [line("/e?n=result_share&scn=chai-momo-v1&via=whatsapp")] * 5
        L += [line("/e?n=result_share_click&scn=chai-momo-v1&via=whatsapp")] * 7
        L += [line("/e?n=referred_visit&scn=chai-momo-v1&p=%2Frizz-test%2F&src=share")] * 10
        L += [line("/e?n=referred_completion&scn=chai-momo-v1")] * 4
        L += ['{"not json', line("/somewhere-else"), line("/e?x=1"), ""]  # junk is ignored
        return L

    def test_funnel_counts_and_multiplier(self):
        out = io.StringIO()
        counts, mult = er.report(er.parse(self.sample()), out)
        self.assertEqual(counts["landing_view"], 40)  # only /rizz-test/ landings count
        self.assertEqual(counts["challenge_start"], 30)
        self.assertEqual(counts["challenge_complete"], 20)
        self.assertEqual(counts["result_share"], 5)
        # 5/20 sharers × 10/5 visitors per sharer × 4/10 referred completions = 0.2
        self.assertAlmostEqual(mult, 0.2)
        text = out.getvalue()
        self.assertIn("whatsapp", text)
        self.assertIn("small samples", text)  # 20, 5 and 10 are all < 30
        self.assertIn("AI cost per completed session: 0", text)

    def test_since_filter(self):
        old = [line("/e?n=challenge_complete&sb=0-9", ts=1700000000)]
        import datetime
        ev = er.parse(old + self.sample(), since=datetime.date(2026, 11, 1))
        self.assertEqual(sum(1 for e in ev if e["n"] == "challenge_complete"), 20)

    def test_empty_log_does_not_crash(self):
        counts, mult = er.report(er.parse([]), io.StringIO())
        self.assertIsNone(mult)
        self.assertEqual(counts["challenge_complete"], 0)


if __name__ == "__main__":
    unittest.main()
