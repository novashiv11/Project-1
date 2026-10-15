"""The web app (app/lifeos.html) re-implements the parser in JS. Keep both in lockstep."""
import json
import shutil
import subprocess
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from lifeos.domains import AREAS, lead_days
from lifeos.parse import parse

ROOT = Path(__file__).resolve().parent.parent
CASES = [e for a in AREAS for e in a["examples"]] + [
    "car insurance renew 10 jan", "health insurance renew 5 jan", "credit card bill due 5th", "gym fees due friday",
    "pay rent friday", "parcel due tomorrow", "papa ki dawai khatam", "feeling low today",
    "slept 6.5 hours, 8000 steps, mood 5", "spent ₹1,250 on groceries", "ran 5km then paani 2 litres",
    "bp 128/84 sugar 110", "kal dentist 4pm", "shukravar ko party 8pm", "idea: dog treat subscription",
    "1Z999AA10123456784 arriving tomorrow", "random thought", "my weight 72kg", "dog weight 24.5kg",
    "bins every other week", "food: Greek Yoghurt (150 g) · 146 kcal · 13.5 g protein · 5.7 g sugar", "lunch 650 kcal", "Passport renewal: chase embassy (application delivered 25 Aug)",
    "Local Property Tax: last paid 27 Oct 2025, next due around Nov 2026", "Acoustic wall panels: wait for Black Friday on 27 Nov",
    "Sony return: Oct 2026", "Mom birthday 19 Sep", "Currys refund: deadline was 14 Oct 2026", "Eir: every month", "Mortgage every 1st", "Change elec and gas supplier", "Eir bill every month on the 5th", "rent every month on the 20th", "gym every monday 7am", "lunch with Ravi on Nov 2nd at 13:30", "vet 3 din baad",
]
HARNESS = """
const exp=require(process.argv[2]); const T=new Date(2026,9,14); const bad=[];
for(const [c,e] of Object.entries(exp)){const p=parse(c,T);
  const got=[p.domain,p.due,p.metrics.map(m=>[m.name,m.value]),leadDays(p),p.repeat];
  if(JSON.stringify(got)!==JSON.stringify(e))bad.push([c,got,e]);}
console.log(JSON.stringify(bad));
"""


@unittest.skipUnless(shutil.which("node"), "node not installed")
class ParityTest(unittest.TestCase):
    def test_js_parser_matches_python(self):
        now = datetime(2026, 10, 14, 9, 0)
        exp = {}
        for c in CASES:
            p = parse(c, now)
            exp[c] = [p["domain"], p["due"], [[m["name"], m["value"]] for m in p["metrics"]], lead_days(p), p["repeat"]]
        page = (ROOT / "app/lifeos.html").read_text(encoding="utf-8")
        self.assertIn(json.dumps(json.loads((ROOT / "lifeos/life.json").read_text())["areas"][0]["id"]), page,
                      "app/lifeos.html is stale: run python3 scripts/build_app.py")
        js = page[page.index("<script>") + 8:page.index("/* ---------- ask")]
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "exp.json").write_text(json.dumps(exp, ensure_ascii=False), encoding="utf-8")
            (Path(tmp) / "run.js").write_text(js + HARNESS, encoding="utf-8")
            out = subprocess.run(["node", "run.js", "./exp.json"], cwd=tmp, capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(out.stdout), [])
