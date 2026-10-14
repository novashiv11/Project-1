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
        self.check("dog vet appointment next friday 5pm", "pet", "2026-10-16T17:00")
        self.check("passport expires 2027-03-14", "document", "2027-03-14")
        self.check("call landlord about rent tomorrow", "home", "2026-10-15")
        self.check("idea: app that rates chai stalls", "idea")
        self.check("feeling great today, ran 5k", "health", "2026-10-14")
        self.check("mom birthday 3 jan", "family", "2027-01-03")
        self.check("dentist in 2 weeks", "health", "2026-10-28")
        self.check("lunch with Ravi on Nov 2nd at 13:30", "social", "2026-11-02T13:30")
        self.check("just a quiet evening", "journal")
        self.check("idea: dog treat subscription", "idea")
        self.check("journal: the dog was hilarious today", "journal", "2026-10-14")

    def test_tracking_and_tags(self):
        p = self.check("1Z999AA10123456784 arriving tomorrow #amazon", "shopping", "2026-10-15")
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


class StoreCase(unittest.TestCase):
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


class V02Test(StoreCase):
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
        m = lambda t: {x["name"]: x["value"] for x in parse(t, NOW)["metrics"]}
        self.assertEqual(m("dog weight 24.5kg"), {"pet.weight": 24.5})
        self.assertEqual(m("my weight is 72 kg"), {"me.weight": 72.0})
        self.assertEqual(m("mood 7/10, chill day"), {"mood": 7.0})
        self.assertEqual(m("slept 6.5 hours, 8000 steps, mood 5"), {"sleep": 6.5, "steps": 8000, "mood": 5})
        self.assertEqual(m("spent ₹1,250 on groceries"), {"spent": 1250})
        self.assertEqual(m("€45 at tesco"), {"spent": 45})
        self.assertEqual(m("ran 5km then paani 2 litres"), {"distance": 5, "water": 2})
        self.assertEqual(m("bp 128/84 sugar 110"), {"bp": 128, "sugar": 110})

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
        self.assertIn("Pets", self.cli("dog"))

    def test_dog_and_review(self):
        self.TODAY = date.today()  # review windows on real creation timestamps
        self.cli("dog weight 24kg")
        self.cli("dog rabies vaccine at vet in 2 days")
        self.cli("idea: dog treat subscription")
        self.cli("mood 8")
        dog = self.cli("dog")
        self.assertIn("pet.weight: 24 kg", dog)
        self.assertIn("rabies", dog)
        review = self.cli("review")
        for s in ("Captured 4", "Ideas this week", "treat subscription", "mood: 8", "Journal prompt"):
            self.assertIn(s, review)


class V03Test(StoreCase):
    def test_hinglish_dates(self):
        self.assertEqual(parse("kal dentist", NOW)["due"], "2026-10-15")
        self.assertEqual(parse("parso bijli bill", NOW)["due"], "2026-10-16")
        self.assertEqual(parse("aaj dog grooming", NOW)["due"], "2026-10-14")
        self.assertEqual(parse("agle hafte trip", NOW)["due"], "2026-10-21")
        self.assertEqual(parse("vet 3 din baad", NOW)["due"], "2026-10-17")
        self.assertEqual(parse("shukravar ko party 8pm", NOW)["due"], "2026-10-16T20:00")
        self.assertEqual(parse("ravivar ko walk", NOW)["due"], "2026-10-18")
        self.assertIsNone(parse("kalpana called", NOW)["due"])

    def test_ask(self):
        self.cli("dog rabies vaccine 2026-10-20")
        self.cli("dog deworming 2026-11-05")
        self.cli("passport expires 2027-03-14")
        out = self.cli("when", "is", "the", "dog's", "next", "vaccination?")
        self.assertTrue(out.startswith("👉 dog rabies vaccine"), out)
        self.assertIn("in 6d", out)
        self.assertIn("2027-03-14", self.cli("ask", "passport", "kab", "hai"))
        self.assertIn("Nothing", self.cli("ask", "zebra"))
        self.assertIn("Saved", self.cli("idea:", "what", "if", "dogs", "talked?"))

    def test_edit_and_undo(self):
        self.cli("vet tomorrow")
        self.assertIn("2026-10-17", self.cli("edit", "1", "vet", "saturday"))
        self.assertEqual(self.store.get(1)["due"], "2026-10-17")
        self.assertIn("Undid edit #1", self.cli("undo"))
        self.assertEqual(self.store.get(1)["due"], "2026-10-15")
        self.assertIn("Undid add #1", self.cli("undo"))
        self.assertIsNone(self.store.get(1))
        self.assertIn("Nothing to undo", self.cli("undo"))
        self.assertIn("Saved", self.cli("edit", "the", "essay"))  # not a command

    def test_ics(self):
        self.cli("dog flea meds every 30 days")
        self.cli("passport expires 2027-03-14")
        self.cli("call mom tomorrow 6pm")
        self.cli("random undated note")
        ics = self.cli("export", "ics")
        self.assertEqual(ics.count("BEGIN:VEVENT"), 3)
        self.assertIn("RRULE:FREQ=DAILY;INTERVAL=30", ics)
        self.assertIn("DTSTART;VALUE=DATE:20270314", ics)
        self.assertIn("TRIGGER:-P30D", ics)
        self.assertIn("DTSTART:20261015T180000", ics)

    def test_ics_escaping(self):
        from lifeos.ics import _esc
        self.assertEqual(_esc("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne")


class WebTest(StoreCase):
    def start(self, token=""):
        import threading
        from http.server import ThreadingHTTPServer
        from lifeos.web import make_handler
        srv = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.store, token, self.TODAY))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        return f"http://127.0.0.1:{srv.server_port}/"

    def post(self, url, **form):
        from urllib.parse import urlencode
        from urllib.request import urlopen
        with urlopen(url, data=urlencode(form).encode()) as r:
            return r.read().decode()

    def test_capture_ask_done_and_escaping(self):
        url = self.start()
        out = self.post(url, q="dog vet tomorrow <script>")
        self.assertIn("Saved", out)
        self.assertIn("&lt;script&gt;", out)
        self.assertNotIn("<script>", out)
        self.assertIn('value="done 1"', self.post(url, q="today"))
        self.assertIn("👉 dog vet", self.post(url, q="vet kab hai?"))
        self.assertIn("Done", self.post(url, q="done 1"))
        self.assertIn("LifeOS", self.post(url, q="list --bogus"))  # argparse error doesn't crash

    def test_token_required_when_set(self):
        from urllib.error import HTTPError
        from urllib.request import urlopen
        url = self.start(token="s3cret")
        with self.assertRaises(HTTPError) as e:
            urlopen(url)
        self.assertEqual(e.exception.code, 403)
        with self.assertRaises(HTTPError):
            self.post(url, q="hello", t="wrong")
        self.assertIn("Saved", self.post(url, q="hello", t="s3cret"))
        self.assertEqual(len(self.store.items()), 1)


class AreasTest(StoreCase):
    def test_every_area_classifies_its_own_examples(self):
        from lifeos.domains import AREAS
        for a in AREAS:
            for ex in a["examples"]:
                self.assertEqual(parse(ex, NOW)["domain"], a["id"], ex)

    def test_tricky_routing(self):
        cases = {"car insurance renew 10 jan": "vehicle", "health insurance renew 5 jan": "document",
                 "credit card bill due 5th": "money", "gym fees due friday": "money",
                 "pay rent friday": "home", "parcel due tomorrow": "shopping", "ac service kal": "home",
                 "papa ki dawai khatam": "family", "feeling low today": "mind", "read atomic habits": "growth",
                 "dentist kal 4pm": "health", "client call friday": "work", "random thought": "journal"}
        for text, want in cases.items():
            self.assertEqual(parse(text, NOW)["domain"], want, text)

    def test_lead_times(self):
        from lifeos.domains import lead_days
        lead = lambda t: lead_days(parse(t, NOW))
        self.assertEqual(lead("passport expires 2027-03-14"), 180)
        self.assertEqual(lead("car insurance expires 2027-02-10"), 30)
        self.assertEqual(lead("rent agreement expires 2027-08-01"), 60)
        self.assertEqual(lead("flight to goa 20 dec"), 14)
        self.assertEqual(lead("mom birthday 3 jan"), 7)
        self.assertEqual(lead("IRP card expires 2027-01-20"), 84)
        self.assertEqual(lead("NCT due 2027-02-10"), 30)

    def test_wheel_area_and_legacy_records(self):
        import json
        self.store.path.write_text(json.dumps({"id": 1, "created": "2026-10-01T10:00:00", "done": False,
            "text": "dog weight 20kg", "domain": "dog", "due": None, "tags": [], "tracking": [],
            "metric": {"name": "dog.weight", "value": 20.0}}) + "\n")
        self.cli("dog weight 22kg")
        self.cli("rent every month")
        pet = self.cli("area", "pet")
        self.assertIn("pet.weight: 20 → 22 kg", pet)
        wheel = self.cli("wheel")
        self.assertIn("Pets: 2 open", wheel)
        self.assertIn("Home: 1 open", wheel)
        self.assertIn("Not tracking yet:", wheel)
        self.assertIn("Vehicle", self.cli("areas"))
        self.assertIn("Saved", self.cli("area", "of", "focus"))  # not a command
        self.assertIn("rent every month", self.cli("list", "--domain", "house"))
