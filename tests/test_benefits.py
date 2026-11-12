"""Claim: eligibility rules (node), then the phone flow: profile → qualify → draft email (BCC, no PPS) → booked → reminder."""
import json
import shutil
import subprocess
import unittest
from urllib.parse import unquote
from pathlib import Path

from tests.test_e2e import PhoneBase

ROOT = Path(__file__).resolve().parent.parent
HARNESS = r"""
const E=require(process.argv[1]), S=require(process.argv[2]); const d=S[0], o=S[1], out={};
const ok={work:"employee",age_band:"29-65",prsi_years:6,prsi_recent:"yes",town:"Galway"};
out.yes=E.check(ok,d).status;
out.young=E.check({...ok,age_band:"21-24",prsi_years:1},d).status;
out.short=E.check({...ok,prsi_years:3},d);
out.notWorking=E.check({...ok,work:"other"},d).status;
out.noRecent=E.check({...ok,prsi_recent:"no"},d).status;
out.need=E.check({work:"employee",age_band:"29-65"},d);
out.empty=E.check({},d).status;
out.nextDental=E.nextEligible(d,"2026-11-20"); out.nextEye=E.nextEligible(o,"2026-11-20");
out.avail=[E.available(d,{},"2026-11-11"),E.available(d,{"prsi-dental":{last:"2026-03-01"}},"2026-11-11"),E.available(d,{"prsi-dental":{last:"2026-03-01"}},"2027-01-01"),
  E.available(o,{"prsi-optical":{last:"2026-03-01"}},"2027-06-01"),E.available(o,{"prsi-optical":{last:"2026-03-01"}},"2028-01-01")];
out.yearEnd=[E.useItOrLoseIt(d,{},"2026-11-11"),E.useItOrLoseIt(d,{},"2026-06-11"),E.useItOrLoseIt(o,{},"2026-11-11")];
const m=E.draft(d,ok,"Asha Example",{when:"weekday mornings",phone:"0851234567 PPS 1234567AB"}); out.draft=m;
out.emails=E.emails("a@x.ie, b@y.ie;c@z.ie bad d@w.ie");
out.mail1=E.mailto(["a@x.ie"],"S","B"); out.mail3=E.mailto(["a@x.ie","b@y.ie"],"S","B");
out.route=[E.route("dental check-up",S)?.id,E.route("eye test kab?",S)?.id,E.route("buy milk",S)?.id||null];
out.sources=S.every(s=>/^https:\/\/www\.gov\.ie\//.test(s.source)&&s.verified&&s.panel.startsWith("https://www.gov.ie/"));
console.log(JSON.stringify(out));
"""


@unittest.skipUnless(shutil.which("node"), "node not installed")
class EntitleCoreTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        r = subprocess.run(["node", "-e", HARNESS, str(ROOT / "app/ui/entitle-core.js"), str(ROOT / "app/ui/schemes.js")],
                           capture_output=True, text=True)
        if r.returncode:
            raise AssertionError(r.stderr)
        cls.o = json.loads(r.stdout)

    def test_rules(self):
        o = self.o
        self.assertEqual([o["yes"], o["young"], o["notWorking"], o["noRecent"], o["empty"]], ["yes", "yes", "no", "no", "need"])
        self.assertEqual(o["short"]["status"], "no")           # 29+ needs about 5 years
        self.assertIn("5 years", o["short"]["reason"])
        self.assertEqual(o["need"], {"status": "need", "ask": {"field": "prsi_years", "question": "How long have you paid PRSI?"}})

    def test_renewal_dates(self):
        o = self.o
        self.assertEqual(o["nextDental"], "2027-01-01")        # every calendar year
        self.assertEqual(o["nextEye"], "2028-01-01")           # every second calendar year
        self.assertEqual(o["avail"], [True, False, True, False, True])
        self.assertEqual(o["yearEnd"], [True, False, False])

    def test_draft_never_carries_a_pps_number(self):
        m = self.o["draft"]
        self.assertIn("PRSI Treatment Benefit", m["body"])
        self.assertIn("weekday mornings", m["body"])
        self.assertIn("Asha Example", m["body"])
        self.assertNotIn("1234567", m["body"])
        self.assertEqual(self.o["emails"], ["a@x.ie", "b@y.ie", "c@z.ie"])   # max 3
        self.assertTrue(self.o["mail1"].startswith("mailto:a%40x.ie?subject=S"))
        self.assertTrue(self.o["mail3"].startswith("mailto:?bcc=a%40x.ie%2Cb%40y.ie&subject=S"))

    def test_router_and_sources(self):
        self.assertEqual(self.o["route"], ["prsi-dental", "prsi-optical", None])
        self.assertTrue(self.o["sources"])


class ClaimFlowTest(PhoneBase):
    def setUp(self):
        super().setUp()
        self.pg.evaluate("localStorage.setItem('lifeos.settings', '{}'); 0")  # fresh user → feed home
        self.pg.reload()
        self.pg.wait_for_function("typeof items !== 'undefined' && backend && R2.migrated")

    def fill_profile(self):
        self.pg.fill("[data-bn-f=town]", "Galway")
        self.pg.select_option("[data-bn-f=work]", "employee")
        self.pg.select_option("[data-bn-f=age_band]", "29-65")
        self.pg.fill("[data-bn-f=prsi_years]", "6")
        self.pg.select_option("[data-bn-f=prsi_recent]", "yes")
        self.pg.click("#bnProfile button[type=submit]")

    def test_profile_to_booked(self):
        self.assertIn("Check what you're owed", self.pg.inner_text("#view"))      # home card before the profile exists
        self.pg.click("#view [data-v=benefits]")
        self.fill_profile()
        self.assertEqual(self.pg.locator(".bn-tag.yes").count(), 2)
        self.pg.click("[data-bn-open=prsi-dental]")
        self.assertIn("Galway", unquote(self.pg.get_attribute(".bn-step a.go", "href")))
        self.pg.fill("[data-bn-d=emails]", "one@clinic.ie, two@clinic.ie")
        self.pg.click("[data-bn-d=when]")                       # moving to the next box must not redraw the form
        self.pg.keyboard.type("weekday mornings")
        self.assertEqual(self.pg.input_value("[data-bn-d=when]"), "weekday mornings")
        self.assertIn("weekday mornings", self.pg.inner_text("#bnBody"))
        href = self.pg.get_attribute("#bnMail", "href")
        self.assertTrue(href.startswith("mailto:?bcc=one%40clinic.ie%2Ctwo%40clinic.ie"))
        self.assertIn("PRSI Treatment Benefit", unquote(href))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.pg.click("[data-bn-done]")
        self.pg.wait_for_function("items.size === 1")
        rec = self.pg.evaluate("[...items.values()][0]")
        year = int(self.pg.evaluate("R2.todayIso().slice(0,4)"))
        self.assertEqual((rec["type"], rec["date"]), ("deadline", f"{year + 1}-01-01"))
        self.assertIn("free again from", self.pg.inner_text("#view"))
        self.pg.reload()                                                           # profile and claim survive a restart
        self.pg.wait_for_function("typeof items !== 'undefined' && backend")
        cards = self.pg.inner_text("#view")
        self.assertIn("Eye test", cards)                                           # still unclaimed → on the home feed
        self.assertNotIn("Dental check-up: free", cards)

    def test_typing_dental_opens_the_scheme_not_a_note(self):
        self.pg.evaluate("settings.profile={town:'Galway',work:'employee',age_band:'29-65',prsi_years:6,prsi_recent:'yes'}; saveSettings(); 0")
        self.pg.fill("#q", "dental check-up")
        self.pg.press("#q", "Enter")
        self.pg.wait_for_function("document.body.dataset.view === 'benefits'")
        self.assertIn("Find a dentist", self.pg.inner_text("#view").replace("FIND A DENTIST", "Find a dentist"))
        self.assertEqual(self.pg.evaluate("items.size"), 0)
        self.pg.evaluate("view='now'; render(); 0")
        for n, note in enumerate(("dentist kal 4pm", "dentist on friday", "eye test 3 dec"), 1):   # real appointments are still saved
            self.pg.fill("#q", note)
            self.pg.press("#q", "Enter")
            self.pg.wait_for_function(f"items.size === {n}")
            self.assertEqual(self.pg.get_attribute("body", "data-view"), "now")

    def test_not_qualifying_says_why(self):
        self.pg.evaluate("settings.profile={town:'Galway',work:'employee',age_band:'29-65',prsi_years:2,prsi_recent:'yes'}; saveSettings(); view='benefits'; render(); 0")
        self.assertIn("about 5 years", self.pg.inner_text("#view"))
        self.assertEqual(self.pg.locator("[data-bn-open]").count(), 0)


if __name__ == "__main__":
    unittest.main()
