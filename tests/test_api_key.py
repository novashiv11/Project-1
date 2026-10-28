"""API-key Jarvis: the key is checked before saving, monthly cost shows, offline questions still get a list answer."""
import json
import unittest

from tests.test_e2e import PhoneBase, CORS


class ApiKeyTest(PhoneBase):
    def open_setup(self):
        self.tab("jarvis")
        self.pg.click("[data-chat=settings] >> nth=0")
        self.pg.wait_for_selector("#skey")

    def test_bad_key_is_not_saved(self):
        self.pg.route("https://api.anthropic.com/**", lambda r: r.fulfill(status=401, content_type="application/json",
                      headers=CORS, body=json.dumps({"error": {"message": "invalid x-api-key"}})))
        self.open_setup()
        self.pg.fill("#skey", "sk-bad")
        self.pg.click("#setup button[type=submit]")
        self.pg.wait_for_function("document.getElementById('toastMsg').textContent.includes('nahi chali')")
        self.assertFalse(self.pg.evaluate("settings.key || ''"))

    def test_good_key_saves_and_shows_cost(self):
        self.open_setup()
        self.pg.fill("#skey", "sk-good")
        self.pg.click("#setup button[type=submit]")
        self.pg.wait_for_function("settings.key === 'sk-good'")
        self.pg.fill("#cq", "IRP card expires 2027-01-20 yaad rakhna")
        self.pg.press("#cq", "Enter")
        self.pg.wait_for_function("!chatBusy && items.size >= 1")
        self.assertIn("is mahine $", self.pg.inner_text(".jhead"))
        sys = self.claude_calls[-1]["body"]["system"][0]["text"]
        self.assertIn("personal memory", sys)

    def test_offline_question_falls_back_to_list(self):
        self.add("passport expires 2027-03-14")
        self.pg.wait_for_function("items.size >= 1")
        self.pg.route("https://api.anthropic.com/**", lambda r: r.abort())
        self.pg.evaluate("settings.key='sk-x'; 0")
        self.tab("jarvis")
        self.pg.fill("#cq", "passport kab expire hoga?")
        self.pg.press("#cq", "Enter")
        self.pg.wait_for_function("!chatBusy")
        self.assertIn("passport expires 2027-03-14", self.pg.inner_text(".chat"))


if __name__ == "__main__":
    unittest.main()
