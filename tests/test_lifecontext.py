"""Jarvis 'My life' context: taught by hand or by link, sent with every Claude handoff, grows from learn:/forget: lines."""
import base64
import json
import unittest
from urllib.parse import unquote

from tests.test_e2e import PhoneBase

STUB = "window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return null}; navigator.clipboard.writeText=async()=>{}; 0"


class LifeContextTest(PhoneBase):
    def life(self):
        return self.pg.evaluate("settings.lifeContext || ''")

    def paste(self, text):
        if not self.pg.is_visible("#paste"):
            self.pg.click("[data-showpaste]")
        self.pg.fill("#paste", text)
        self.pg.click("#pasteform button[type=submit]")
        self.pg.click("[data-paste=apply]")

    def test_teach_handoff_and_learning(self):
        self.pg.evaluate(STUB)
        self.tab("jarvis")
        self.pg.click("[data-teach]")
        self.pg.fill("#ctx", "## Pets\n- Dog Bruno\n- Lives in Galway")
        self.pg.click("[data-teachsave]")
        self.assertIn("Dog Bruno", self.life())
        self.pg.fill("#aq", "Bruno ka vet kab hai?")
        self.pg.press("#aq", "Enter")
        prompt = unquote(self.pg.evaluate("window.__opened[0]"))
        self.assertIn("About me", prompt)
        self.assertIn("Dog Bruno", prompt)
        self.assertIn("learn: <short fact>", prompt)
        self.paste("LIFEOS\n+ Bruno vet 20 nov\nlearn: Bruno is scared of fireworks\nforget: Lives in Galway\nlearn: Lives in Dublin 15 since 2021 PPSN 1234567")
        self.pg.wait_for_function("items.size >= 1")
        c = self.life()
        self.assertIn("Bruno is scared of fireworks", c)
        self.assertNotIn("Galway", c)
        self.assertNotIn("1234567", c)
        self.assertIn("1 saved", self.pg.inner_text("#toast"))

    def test_refresh_block_replaces_context(self):
        self.pg.evaluate(STUB + "; settings.lifeContext='old'; 0")
        self.tab("jarvis")
        self.pg.click("[data-teach]")
        self.pg.click("[data-teachrefresh]")
        self.assertIn("LIFECONTEXT", unquote(self.pg.evaluate("window.__opened[0]")))
        self.paste("Sure!\nLIFECONTEXT\n## Me\n- From India, lives in Ireland\n## Pets\n- Dog Bruno")
        self.pg.wait_for_function("(settings.lifeContext||'').includes('From India')")
        self.assertNotIn("old", self.life())

    def test_link_loads_context_for_review(self):
        text = "## Me\n- Hinglish, short answers 🙏"
        frag = base64.urlsafe_b64encode(text.encode()).decode()
        self.pg.goto(self.url + "#ctx=" + frag)
        self.pg.wait_for_selector("#ctx")
        self.assertEqual(self.pg.input_value("#ctx"), text)
        self.assertEqual(self.life(), "")  # nothing saved until the person taps Save
        self.pg.click("[data-teachsave]")
        self.assertEqual(self.life(), text)
        self.assertNotIn("#ctx", self.pg.url)
        self.assertIn("lifeContext", self.pg.evaluate("JSON.stringify(settings)"))

    def test_api_mode_remember_fact_and_system(self):
        bodies = []

        def api(route):
            body = json.loads(route.request.post_data)
            bodies.append(body)
            if body["messages"][-1]["content"][0].get("type") == "tool_result":
                resp = {"content": [{"type": "text", "text": "Yaad rakh liya."}], "stop_reason": "end_turn"}
            else:
                resp = {"content": [{"type": "tool_use", "id": "t1", "name": "remember_fact",
                                     "input": {"fact": "Works in Dublin city centre", "forget": ""}}], "stop_reason": "tool_use"}
            route.fulfill(status=200, content_type="application/json",
                          headers={"access-control-allow-origin": "*"}, body=json.dumps(resp))
        self.pg.route("https://api.anthropic.com/**", api)
        self.pg.evaluate("settings.key='sk-test'; settings.lifeContext='- Dog Bruno'; 0")
        self.tab("jarvis")
        self.pg.fill("#cq", "I work in Dublin city centre")
        self.pg.press("#cq", "Enter")
        self.pg.wait_for_function("(settings.lifeContext||'').includes('Dublin city centre')")
        sys = bodies[0]["system"]
        self.assertIn("cache_control", sys[0])
        self.assertIn("Dog Bruno", sys[1]["text"])
        self.assertIn("remember_fact", [t["name"] for t in bodies[0]["tools"]])


if __name__ == "__main__":
    unittest.main()
