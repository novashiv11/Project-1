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
