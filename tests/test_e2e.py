"""End-to-end test of the phone app (dist/) in headless Chromium at phone size.

Skipped when Playwright or Chromium isn't installed. Network is never used: the barcode scanner,
Open Food Facts and the Claude API are faked, so this checks our wiring, not those services.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

FAKE_SCANNER = """window.BarcodeDetector = class {
  static async getSupportedFormats() { return ['ean_13', 'qr_code']; }
  async detect() { return window.__code ? [window.__code] : []; } };"""
FOOD = {"status": 1, "product": {"product_name": "Greek Yoghurt", "brands": "Glenisk", "nutriscore_grade": "b",
        "serving_quantity": "125", "nutriments": {"energy-kcal_100g": 97, "sugars_100g": 3.8, "proteins_100g": 9}}}
CORS = {"access-control-allow-origin": "*"}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


@unittest.skipUnless(sync_playwright and Path(CHROME).exists(), "playwright/chromium not available")
class PhoneAppTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run([sys.executable, str(ROOT / "scripts/build_pwa.py")], check=True, capture_output=True)
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT / "dist")))
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.srv.server_port}/"
        cls.tmp = tempfile.mkdtemp()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=CHROME)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.srv.shutdown(); cls.srv.server_close(); shutil.rmtree(cls.tmp)

    def setUp(self):
        self.ctx = self.browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                                            accept_downloads=True)
        self.ctx.add_init_script(FAKE_SCANNER)
        self.claude_calls = []
        self.ctx.route("https://world.openfoodfacts.org/**",
                       lambda r: r.fulfill(status=200, content_type="application/json", headers=CORS, body=json.dumps(FOOD)))
        self.ctx.route("https://api.anthropic.com/**", self._fake_claude)
        self.pg = self.ctx.new_page()
        self.errors = []
        self.pg.on("pageerror", lambda e: self.errors.append(str(e)))
        self.pg.goto(self.url)
        self.pg.wait_for_function("typeof items !== 'undefined' && backend")
        self.photo = str(Path(self.tmp) / "photo.jpg")
        if not Path(self.photo).exists():
            self.pg.screenshot(path=self.photo, type="jpeg")

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.ctx.close()

    def _fake_claude(self, route):
        body = json.loads(route.request.post_data)
        self.claude_calls.append({"headers": route.request.headers, "body": body})
        if body["messages"][-1]["content"][0].get("type") == "tool_result":
            resp = {"content": [{"type": "text", "text": "Saved it."}], "stop_reason": "end_turn"}
        else:
            resp = {"content": [{"type": "tool_use", "id": "t1", "name": "add_item",
                                 "input": {"text": "IRP card expires 2027-01-20"}}], "stop_reason": "tool_use"}
        route.fulfill(status=200, content_type="application/json", headers=CORS, body=json.dumps(resp))

    def add(self, *texts):
        for t in texts:
            self.pg.fill("#q", t)
            self.pg.press("#q", "Enter")

    def items(self):
        return self.pg.evaluate("[...items.values()].map(i => i.text)")

    def test_fits_phone_width_on_every_tab(self):
        self.add("passport expires 2027-03-14", "NCT due in 20 days", "lunch 650 kcal")
        for tab in ("today", "life", "review", "all", "jarvis"):
            self.pg.click(f"#tab-{tab}")
            self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390, tab)

    def test_brief_guides_and_renewal_nudges(self):
        self.add("NCT due in 20 days", "IRP card expires in 60 days")
        self.pg.click("#tab-today")
        self.assertIn("ab start karo", self.pg.inner_text(".brief"))
        self.assertIn("start now", self.pg.inner_text(".cards"))
        self.pg.click("button[data-guide]")
        self.assertTrue(self.pg.eval_on_selector_all(".guide a", "els => els.every(e => e.href.startsWith('https://'))"))
        nudges = self.pg.evaluate("""new Promise(ok => { const r = indexedDB.open('lifeos', 1);
          r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('nudges');
          q.onsuccess = () => ok(JSON.parse(q.result)); }; })""")
        kinds = {(n["kind"], n["text"]) for n in nudges}
        self.assertIn(("window", "IRP card expires in 60 days"), kinds)  # 84-day lead → window already open
        self.assertIn(("due", "NCT due in 20 days"), kinds)

    def test_food_scan_portion_and_daily_total(self):
        self.pg.evaluate("settings.kcalGoal = '2000'")
        self.add("lunch 650 kcal")
        self.pg.evaluate("window.__code = {format: 'ean_13', rawValue: '5391500100046'}")
        self.pg.set_input_files("#cam", self.photo)
        self.pg.wait_for_selector("#fgrams")
        self.assertEqual(self.pg.input_value("#fgrams"), "125")
        self.pg.fill("#fgrams", "150")
        self.pg.click("button[data-scan=food]")
        self.pg.click("#tab-today")
        self.pg.wait_for_selector(".food")
        self.assertEqual(self.pg.inner_text(".food .big"), "796")  # 650 + 97*1.5
        self.assertIn("of 2000 kcal", self.pg.inner_text(".food"))

    def test_qr_code(self):
        self.pg.evaluate("window.__code = {format: 'qr_code', rawValue: 'https://www.ncts.ie/'}")
        self.pg.set_input_files("#cam", self.photo)
        self.pg.wait_for_selector(".scan a")
        self.pg.click("button[data-scan=save]")
        self.assertIn("QR: https://www.ncts.ie/", self.items())

    def test_backup_and_restore(self):
        self.add("passport expires 2027-03-14", "rent every month")
        self.pg.click("#tab-all")
        with self.pg.expect_download() as dl:
            self.pg.click("button[data-data=backup]")
        path = str(Path(self.tmp) / "backup.json")
        dl.value.save_as(path)
        self.pg.evaluate("settings.key = 'sk-secret'; saveSettings()")
        self.assertNotIn("sk-secret", Path(path).read_text())
        self.pg.evaluate("localStorage.removeItem('lifeos.items.v1')")
        self.pg.reload()
        self.pg.wait_for_function("typeof items !== 'undefined' && backend")
        self.assertEqual(self.items(), [])
        self.pg.click("#tab-all")
        self.pg.set_input_files("#restoreFile", path)
        self.pg.click("button[data-data=restore-yes]")
        self.assertEqual(sorted(self.items()), ["passport expires 2027-03-14", "rent every month"])

    def test_jarvis_chat_saves_item(self):
        self.pg.click("#tab-jarvis")
        self.pg.click("button[data-chat=settings]")
        self.pg.fill("#sname", "Shivam")
        self.pg.fill("#skey", "sk-ant-test")
        self.pg.click("#setup button[type=submit]")
        self.pg.fill("#cq", "IRP 20 Jan 2027 ko expire hoga")
        self.pg.press("#cq", "Enter")
        self.pg.wait_for_selector(".msg.bot")
        self.assertIn("IRP card expires 2027-01-20", self.items())
        first, second = self.claude_calls[0], self.claude_calls[1]
        self.assertEqual(first["headers"].get("anthropic-dangerous-direct-browser-access"), "true")
        self.assertEqual(first["body"]["model"], "claude-haiku-5-5")
        self.assertEqual(second["body"]["messages"][1]["role"], "assistant")  # history appended, not edited


    def test_ask_claude_free_flow(self):
        """No API key: question opens the Claude app with the list; pasted LIFEOS lines get saved."""
        self.pg.evaluate("window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; 0")
        self.add("NCT due in 20 days")
        self.pg.click("#tab-jarvis")
        self.pg.fill("#aq", "IRP kab renew karun?")
        self.pg.press("#aq", "Enter")
        url = self.pg.evaluate("window.__opened[0]")
        self.assertTrue(url.startswith("https://claude.ai/new?q="))
        prompt = self.pg.evaluate("decodeURIComponent(window.__opened[0].split('?q=')[1])")
        self.assertIn("IRP kab renew karun?", prompt)
        self.assertIn("NCT due in 20 days", prompt)
        self.assertIn("LIFEOS", prompt)
        self.pg.fill("#paste", "Sure! Start now.\n\nLIFEOS\n+ IRP card expires 2027-01-20\ndone #1\n")
        self.pg.click("#pasteform button[type=submit]")
        self.pg.click("button[data-paste=apply]")
        self.assertIn("IRP card expires 2027-01-20", self.items())
        self.assertTrue(self.pg.evaluate("items.get(1).done"))
        self.assertEqual(self.claude_calls, [])  # no API used

    def test_import_from_claude_memory_and_project_setup(self):
        self.pg.evaluate("window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; "
                         "window.__copied = []; navigator.clipboard.writeText = async (t) => { window.__copied.push(t); }; 0")
        self.add("passport expires 2027-03-14")
        self.pg.click("#tab-jarvis")
        self.pg.click("button[data-memimport]")
        prompt = self.pg.evaluate("decodeURIComponent(window.__opened[0].split('?q=')[1])")
        self.assertIn("memory of me", prompt)
        self.assertIn("passport expires 2027-03-14", prompt)  # already-known items are listed so Claude skips them
        self.pg.wait_for_selector("#pasteform")
        self.pg.click("button[data-project]")
        self.pg.click("button[data-copyinstr]")
        self.assertTrue(any("LIFEOS" in t and "lifeos-backup" in t for t in self.pg.evaluate("window.__copied")))


@unittest.skipUnless(sync_playwright and Path(CHROME).exists(), "playwright/chromium not available")
class GestureTest(PhoneAppTest):
    test_fits_phone_width_on_every_tab = test_brief_guides_and_renewal_nudges = None
    test_food_scan_portion_and_daily_total = test_qr_code = test_backup_and_restore = test_jarvis_chat_saves_item = None
    test_ask_claude_free_flow = test_import_from_claude_memory_and_project_setup = None
    """Swipe right completes, swipe left snoozes a day (inherits the phone setup; runs only these tests)."""
    def _swipe(self, sel, dx):
        box = self.pg.locator(sel).first.bounding_box()
        x, y = box["x"] + 20, box["y"] + box["height"] / 2
        self.pg.mouse.move(x, y); self.pg.mouse.down()
        for i in range(1, 11):
            self.pg.mouse.move(x + dx * i / 10, y)
        self.pg.mouse.up()
        self.pg.wait_for_timeout(450)

    def test_swipe_done_and_snooze(self):
        self.add("dentist kal 4pm", "NCT due tomorrow")
        self.pg.click("#tab-today")
        self._swipe('.card:has-text("dentist")', 160)
        self.assertTrue(self.pg.evaluate("[...items.values()].find(i => i.text.startsWith('dentist')).done"))
        before = self.pg.evaluate("[...items.values()].find(i => i.text.startsWith('NCT')).due")
        self._swipe('.card:has-text("NCT")', -160)
        after = self.pg.evaluate("[...items.values()].find(i => i.text.startsWith('NCT')).due")
        self.assertGreater(after, before)


if __name__ == "__main__":
    unittest.main()
