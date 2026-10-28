"""Letters → reminders (app/ui/letters.js) on a phone: photos → Claude (faked) → review → dated items; no-key paste path."""
import json
import struct
import zlib
from pathlib import Path
from urllib.parse import unquote

from tests.test_e2e import CORS, PhoneBase

STUB = "window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return null}; navigator.clipboard.writeText=async()=>{}; 0"
FOUND = [{"text": "IRP card expires", "date": "2027-01-20", "repeat": None},
         {"text": "Car insurance policy 123456789 renewal", "date": "2027-03-05", "repeat": "every year"}]


def png(path, rgb):
    """Write a tiny 4x4 solid-colour PNG with the stdlib."""
    raw = b"".join(b"\x00" + bytes(rgb) * 4 for _ in range(4))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    Path(path).write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 4, 4, 8, 2, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
    return str(path)


class LettersViewTest(PhoneBase):
    def setUp(self):
        super().setUp()
        self.pngs = [png(Path(self.tmp) / "a.png", (200, 30, 30)), png(Path(self.tmp) / "b.png", (30, 30, 200))]
        self.sent = []

    def fake(self, route):
        self.sent.append(json.loads(route.request.post_data))
        route.fulfill(status=200, content_type="application/json", headers=CORS,
                      body=json.dumps({"content": [{"type": "text", "text": json.dumps(FOUND)}], "stop_reason": "end_turn"}))

    def test_menu_entry(self):
        self.pg.click("#more")
        self.pg.click("#moretools")
        self.assertIn("Letters → reminders", self.pg.inner_text("#tab-letters"))
        self.pg.click("#tab-letters")
        self.assertEqual(self.pg.inner_text("#title"), "Letters")
        self.assertIn("never stored", self.pg.inner_text("#view"))

    def test_key_mode_photos_to_reminders(self):
        self.pg.route("https://api.anthropic.com/**", self.fake)
        self.pg.evaluate("settings.key = 'sk-ant-test'")
        self.tab("letters")
        self.pg.set_input_files("input[data-let-files][multiple]", self.pngs)
        self.pg.wait_for_selector("[data-let-text='1']")
        lines = self.pg.eval_on_selector_all("[data-let-text]", "els => els.map(e => e.value)")
        self.assertEqual(lines[0], "IRP card expires 2027-01-20")
        self.assertIn("Car insurance policy renewal 2027-03-05 every year", lines[1])
        self.assertNotRegex(" ".join(lines), r"\d{6,}")
        self.assertEqual(self.pg.eval_on_selector_all("[data-let-on]:checked", "els => els.length"), 2)
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)

        body = self.sent[0]
        self.assertEqual(body["model"], "claude-sonnet-5-5")
        blocks = body["messages"][0]["content"]
        imgs = [b for b in blocks if b["type"] == "image"]
        self.assertEqual(len(imgs), 2)
        self.assertTrue(all(b["source"]["media_type"] == "image/jpeg" for b in imgs))
        self.assertIn("PPSN", blocks[-1]["text"])

        self.pg.fill("[data-let-text='0']", "IRP card renew 2027-01-20")
        self.assertEqual(self.pg.inner_text("[data-let=add]"), "Add 2")
        self.pg.click("[data-let=add]")
        self.pg.wait_for_function("items.size === 2")
        got = {i["text"]: i for i in self.pg.evaluate("[...items.values()]")}
        self.assertEqual(got["IRP card renew 2027-01-20"]["due"], "2027-01-20")
        car = got["Car insurance policy renewal 2027-03-05 every year"]
        self.assertEqual(car["due"], "2027-03-05")
        self.assertEqual(car["repeat"]["unit"], "year")
        self.assertEqual(self.pg.query_selector_all("[data-let-text]"), [])

    def test_unchecked_rows_are_skipped(self):
        self.pg.route("https://api.anthropic.com/**", self.fake)
        self.pg.evaluate("settings.key = 'sk-ant-test'")
        self.tab("letters")
        self.pg.set_input_files("input[data-let-files][multiple]", self.pngs[:1])
        self.pg.wait_for_selector("[data-let-on='1']")
        self.pg.uncheck("[data-let-on='1']")
        self.assertEqual(self.pg.inner_text("[data-let=add]"), "Add 1")
        self.pg.click("[data-let=add]")
        self.pg.wait_for_function("items.size === 1")
        self.assertEqual(self.items(), ["IRP card expires 2027-01-20"])
        self.assertEqual(len(self.sent[0]["messages"][0]["content"]), 2)  # 1 image + instruction

    def test_free_mode_shares_photos_to_claude(self):
        self.pg.evaluate("""window.__shared=null; navigator.canShare=()=>true;
          navigator.share=async d=>{window.__shared={n:d.files.length,text:d.text}}; navigator.clipboard.writeText=async()=>{}; 0""")
        self.tab("letters")
        self.pg.set_input_files("input[data-let-free]", [str(x) for x in self.pngs])
        self.pg.click("[data-let=share]")
        self.pg.wait_for_function("window.__shared")
        shared = self.pg.evaluate("window.__shared")
        self.assertEqual(shared["n"], 2)
        self.assertIn("LIFEOS", shared["text"])
        self.assertEqual(self.pg.query_selector_all("[data-let=share]"), [])

    def test_no_key_open_claude_and_paste_back(self):
        self.tab("letters")
        self.assertIn("Claude ko bhejo", self.pg.inner_text("#view"))
        self.assertEqual(self.pg.query_selector_all("input[data-let-files]"), [])
        self.pg.evaluate(STUB)
        self.pg.click("[data-let=open]")
        url = self.pg.evaluate("window.__opened[0]")
        self.assertTrue(url.startswith("https://claude.ai/new?q="), url)
        prompt = unquote(url.split("?q=", 1)[1])
        self.assertIn("LIFEOS", prompt)
        self.assertIn("PPSN", prompt)
        self.assertEqual(self.pg.inner_text("#title"), "Letters")  # stays on this screen for the paste
        self.pg.fill("#paste", "Sure!\nLIFEOS\n+ IRP card expires 2027-01-20\n+ Bord Gais bill 2026-11-02 acct 98765432 every month")
        self.pg.click("#letpaste button[type=submit]")
        self.pg.wait_for_selector("[data-let-pv]")
        self.assertNotIn("98765432", self.pg.inner_text("[data-let-pv]"))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.pg.click("[data-let-pv] [data-paste=apply]")
        self.pg.wait_for_function("items.size === 2")
        got = {i["text"]: i for i in self.pg.evaluate("[...items.values()]")}
        self.assertEqual(got["IRP card expires 2027-01-20"]["due"], "2027-01-20")
        bill = got["Bord Gais bill 2026-11-02 acct every month"]
        self.assertEqual(bill["due"], "2026-11-02")
        self.assertEqual(bill["repeat"]["unit"], "month")
        self.assertEqual(self.claude_calls, [])


if __name__ == "__main__":
    import unittest
    unittest.main()
