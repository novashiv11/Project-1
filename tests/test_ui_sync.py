"""Google Drive sync (app/ui/sync.js) on a phone: Google sign-in and Drive REST are faked in memory, no network."""
import json
import re

from tests.test_e2e import PhoneBase

CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS"}
KEY = "sk-ant-SECRET-never-upload"
FAKE_GIS = """window.LIFEOS_GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
window.LIFEOS_SYNC_DEBOUNCE = 300;
window.__tok = [];
window.google = {accounts: {oauth2: {
  initTokenClient(cfg) { return {requestAccessToken(o) { o = o || {}; window.__tok.push(o);
    if (o.prompt === '' && localStorage.getItem('fake.silent') === 'fail')
      setTimeout(() => cfg.error_callback({type: 'popup_failed_to_open'}), 0);
    else setTimeout(() => cfg.callback({access_token: 'tok-' + window.__tok.length, expires_in: 3600}), 0); }}; },
  revoke(t, cb) { cb && cb(); } }}};"""
REMOTE = {"id": 111, "text": "remote passport renew 2027-05-01", "created": "2026-01-01T10:00:00", "done": False,
          "domain": "admin", "metrics": []}


class DriveSyncTest(PhoneBase):
    def setUp(self):
        super().setUp()
        self.file = None  # {"id", "body"}
        self.requests = []
        self.uploads = []
        self.ctx.route("https://accounts.google.com/**", lambda r: r.abort())
        self.ctx.route("https://www.googleapis.com/**", self._drive)

    def configure(self):
        self.ctx.add_init_script(FAKE_GIS)
        self.pg.reload()
        self.pg.wait_for_function("typeof items !== 'undefined' && backend")

    def _drive(self, route):
        req = route.request
        url, method = req.url, req.method
        self.requests.append({"url": url, "method": method, "headers": req.headers, "body": req.post_data or ""})
        ok = lambda body, status=200: route.fulfill(status=status, content_type="application/json", headers=CORS,
                                                    body=json.dumps(body))
        if method == "OPTIONS":
            return route.fulfill(status=204, headers=CORS, body="")
        if not req.headers.get("authorization", "").startswith("Bearer tok-"):
            return ok({"error": "unauthorised"}, 401)
        if method == "GET" and "/drive/v3/files?" in url:
            assert "spaces=appDataFolder" in url
            return ok({"files": [{"id": self.file["id"], "name": "lifeos-items.json"}] if self.file else []})
        if method == "GET" and "alt=media" in url:
            return ok(json.loads(self.file["body"]))
        if method == "POST" and "uploadType=multipart" in url:
            parts = re.split(r"--[^\r\n]+", req.post_data)
            meta = json.loads(parts[1].split("\r\n\r\n", 1)[1])
            assert meta == {"name": "lifeos-items.json", "parents": ["appDataFolder"]}, meta
            body = parts[2].split("\r\n\r\n", 1)[1].strip()
            self.file = {"id": "f1", "body": body}
            self.uploads.append(body)
            return ok({"id": "f1"})
        if method == "PATCH" and "uploadType=media" in url:
            self.file["body"] = req.post_data
            self.uploads.append(req.post_data)
            return ok({"id": self.file["id"]})
        return ok({"error": "unexpected " + method + " " + url}, 400)

    def put(self, *texts):
        n = len(self.items()) + len(texts)
        self.tab("home")
        self.add(*texts)
        self.pg.wait_for_function(f"items.size >= {n}")

    def me(self):
        self.tab("all")
        return self.pg.inner_text("[data-sync-box]")

    def connect(self):
        self.me()
        self.pg.click("[data-sync='connect']")
        self.pg.wait_for_function("settings.syncLast")

    def drive_items(self):
        return {i["text"] for i in json.loads(self.file["body"])["items"]}

    def assert_no_secrets(self):
        for r in self.requests:
            blob = r["url"] + r["body"] + json.dumps(r["headers"])
            self.assertNotIn(KEY, blob)
        self.assertNotIn("tok-", self.pg.evaluate("JSON.stringify({...localStorage})"))  # token stays in memory

    def test_unconfigured_shows_coming_soon(self):
        self.assertIn("Drive sync: coming soon", self.me())
        self.assertEqual(self.pg.evaluate("document.querySelectorAll('[data-sync]').length"), 0)
        self.assertEqual(self.requests, [])

    def test_connect_merges_remote_and_local(self):
        self.configure()
        self.pg.evaluate(f"settings.key = '{KEY}'; saveSettings()")
        self.put("NCT due in 20 days", "dentist on friday")
        nct, dentist = self.pg.evaluate("[...items.values()].map(i => i.id)")
        edited = {"id": dentist, "text": "dentist moved to monday", "created": "2026-01-01T00:00:00",
                  "updated": "2099-01-01T00:00:00", "done": False, "metrics": []}
        older = {"id": nct, "text": "stale NCT copy", "created": "2000-01-01T00:00:00", "done": False, "metrics": []}
        self.file = {"id": "f1", "body": json.dumps({"app": "lifeos", "v": 1, "items": [REMOTE, edited, older],
                                                     "deleted": {}})}
        self.assertIn("Connect Google Drive", self.me())
        self.connect()
        self.pg.wait_for_function("items.size === 3")
        texts = set(self.items())
        self.assertEqual(texts, {"remote passport renew 2027-05-01", "NCT due in 20 days", "dentist moved to monday"})
        self.assertIn("remote passport renew", self.pg.evaluate("localStorage.getItem('lifeos.items.v1')"))
        self.assertEqual(self.drive_items(), texts)  # merged copy pushed back
        self.assertIn("Last synced:", self.me())
        self.assertNotIn("not yet", self.pg.inner_text("[data-sync-last]"))
        self.assertTrue(self.pg.is_visible("[data-sync='off']"))
        self.assert_no_secrets()

    def test_first_connect_creates_file_and_add_pushes(self):
        self.configure()
        self.pg.evaluate(f"settings.key = '{KEY}'; saveSettings()")
        self.put("NCT due in 20 days")
        self.connect()
        self.assertEqual(self.drive_items(), {"NCT due in 20 days"})
        n = len(self.uploads)
        self.put("bin day every tuesday")
        self.pg.wait_for_timeout(1500)
        self.assertGreater(len(self.uploads), n)
        self.assertEqual(self.drive_items(), {"NCT due in 20 days", "bin day every tuesday"})
        self.assertTrue(any(r["method"] == "PATCH" for r in self.requests))
        self.assert_no_secrets()

    def test_delete_sends_tombstone(self):
        self.configure()
        self.put("NCT due in 20 days", "dentist on friday")
        self.connect()
        gone = self.pg.evaluate("[...items.values()].find(i => i.text.startsWith('dentist')).id")
        self.pg.evaluate(f"change({gone}, null, 'Deleted')")
        self.pg.wait_for_timeout(1500)
        doc = json.loads(self.file["body"])
        self.assertEqual({i["text"] for i in doc["items"]}, {"NCT due in 20 days"})
        self.assertIn(str(gone), doc["deleted"])

    def test_boot_pulls_when_silent_token_works(self):
        self.configure()
        self.file = {"id": "f1", "body": json.dumps({"items": [REMOTE], "deleted": {}})}
        self.pg.evaluate("settings.syncOn = true; saveSettings()")
        self.pg.reload()
        self.pg.wait_for_function("items.size === 1 && settings.syncLast")
        self.assertEqual(self.items(), [REMOTE["text"]])
        self.assertEqual(self.pg.evaluate("window.__tok[0].prompt"), "")

    def test_boot_shows_reconnect_and_disconnect_works(self):
        self.configure()
        self.pg.evaluate("localStorage.setItem('fake.silent', 'fail'); settings.syncOn = true; saveSettings()")
        self.pg.reload()
        self.pg.wait_for_function("typeof items !== 'undefined' && backend")
        self.pg.wait_for_timeout(200)
        self.assertIn("Reconnect", self.me())
        self.pg.click("[data-sync='off']")
        self.assertIn("Connect Google Drive", self.pg.inner_text("[data-sync-box]"))
        self.assertFalse(self.pg.evaluate("!!settings.syncOn"))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)


if __name__ == "__main__":
    import unittest
    unittest.main()
