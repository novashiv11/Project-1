import io
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date, datetime
from pathlib import Path

from lifeos.cli import main
from lifeos.parse import parse
from lifeos.store import Store

NOW = datetime(2026, 10, 14, 9, 0)  # a Wednesday


class ParseTest(unittest.TestCase):
    def check(self, text, domain, due=None):
        p = parse(text, NOW)
        self.assertEqual(p["domain"], domain, text)
        self.assertEqual(p["due"], due, text)
        return p

    def test_domains_and_dates(self):
        self.check("dog vet appointment next friday 5pm", "dog", "2026-10-16T17:00")
        self.check("passport expires 2027-03-14", "document", "2027-03-14")
        self.check("call landlord about rent tomorrow", "house", "2026-10-15")
        self.check("idea: app that rates chai stalls", "idea")
        self.check("feeling great today, ran 5k", "health", "2026-10-14")
        self.check("mom birthday 3 jan", "calendar", "2027-01-03")
        self.check("dentist in 2 weeks", "health", "2026-10-28")
        self.check("lunch with Ravi on Nov 2nd at 13:30", "calendar", "2026-11-02T13:30")
        self.check("just a quiet evening", "journal")
        self.check("idea: dog treat subscription", "idea")
        self.check("journal: the dog was hilarious today", "journal", "2026-10-14")

    def test_tracking_and_tags(self):
        p = self.check("1Z999AA10123456784 arriving tomorrow #amazon", "package", "2026-10-15")
        self.assertEqual(p["tracking"], ["1Z999AA10123456784"])
        self.assertEqual(p["tags"], ["amazon"])


class CliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / "j.jsonl")

    def tearDown(self):
        self.tmp.cleanup()

    def run_cli(self, *argv):
        buf = io.StringIO()
        with redirect_stdout(buf):
            main(list(argv), store=self.store, today=date.today())
        return buf.getvalue()

    def test_capture_list_done_today(self):
        self.assertIn("Saved", self.run_cli("walk", "the", "dog", "tomorrow"))
        self.run_cli("add", "random thought")
        self.assertIn("walk the dog", self.run_cli("today"))
        self.assertIn("random thought", self.run_cli("list", "--domain", "journal"))
        self.assertIn("walk the dog", self.run_cli("search", "DOG"))
        self.assertIn("Done", self.run_cli("done", "1"))
        self.assertNotIn("walk the dog", self.run_cli("today"))
        self.assertIn("No item", self.run_cli("done", "99"))
        self.assertEqual(len(self.store.items()), 2)


if __name__ == "__main__":
    unittest.main()


class V02Test(unittest.TestCase):
    TODAY = date(2026, 10, 14)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / "j.jsonl")

    def tearDown(self):
        self.tmp.cleanup()

    def cli(self, *argv):
        buf = io.StringIO()
        with redirect_stdout(buf):
            main(list(argv), store=self.store, today=self.TODAY)
        return buf.getvalue()

    def test_repeat_parsing(self):
        self.assertEqual(parse("dog flea meds every 30 days", NOW)["repeat"], {"every": 30, "unit": "day"})
        self.assertEqual(parse("pay rent monthly", NOW)["repeat"], {"every": 1, "unit": "month"})
        self.assertEqual(parse("bins every other week", NOW)["repeat"], {"every": 2, "unit": "week"})
        p = parse("gym every monday 7am", NOW)
        self.assertEqual((p["repeat"]["unit"], p["due"]), ("week", "2026-10-19T07:00"))
        self.assertEqual(parse("flea meds every 30 days", NOW)["due"], "2026-10-14")  # starts today
        self.assertIsNone(parse("walk the dog", NOW)["repeat"])

    def test_add_interval_clamps_month_end(self):
        from lifeos.parse import add_interval
        self.assertEqual(add_interval(date(2026, 1, 31), 1, "month"), date(2026, 2, 28))
        self.assertEqual(add_interval(date(2028, 2, 29), 1, "year"), date(2029, 2, 28))
        self.assertEqual(add_interval(date(2026, 12, 15), 2, "month"), date(2027, 2, 15))

    def test_metrics(self):
        self.assertEqual(parse("dog weight 24.5kg", NOW)["metric"], {"name": "dog.weight", "value": 24.5})
        self.assertEqual(parse("my weight is 72 kg", NOW)["metric"], {"name": "me.weight", "value": 72.0})
        self.assertEqual(parse("mood 7/10, chill day", NOW)["metric"], {"name": "mood", "value": 7.0})

    def test_document_shows_90_days_ahead(self):
        self.cli("passport expires 2026-12-20")       # 67 days out → visible
        self.cli("dentist on 2026-11-20")              # 37 days out → hidden (7-day lead)
        out = self.cli("today")
        self.assertIn("passport", out)
        self.assertIn("in 67d", out)
        self.assertNotIn("dentist", out)

    def test_recurring_done_rolls_forward(self):
        self.cli("dog flea meds every 30 days")
        self.assertIn("next: 2026-11-13", self.cli("done", "1"))
        self.assertFalse(self.store.get(1)["done"])
        self.cli("buy milk today")
        self.assertIn("Done ✔", self.cli("done", "2"))
        self.assertTrue(self.store.get(2)["done"])

    def test_commands_vs_notes(self):
        self.assertIn("Saved", self.cli("today", "I", "felt", "great"))
        self.assertIn("Saved", self.cli("dog", "vet", "tomorrow"))
        self.assertIn("Saved", self.cli("done", "with", "taxes"))
        self.assertIn("Dog dashboard", self.cli("dog"))

    def test_dog_and_review(self):
        self.TODAY = date.today()  # review windows on real creation timestamps
        self.cli("dog weight 24kg")
        self.cli("dog rabies vaccine at vet in 2 days")
        self.cli("idea: dog treat subscription")
        self.cli("mood 8")
        dog = self.cli("dog")
        self.assertIn("Weight: 24", dog)
        self.assertIn("rabies", dog)
        review = self.cli("review")
        for s in ("Captured 4", "Ideas this week", "treat subscription", "Mood", "Journal prompt"):
            self.assertIn(s, review)
