"""Daily Jarvis update: a home button + morning reminder that sends a 'since last update' prompt to the Claude app."""
import unittest
from urllib.parse import unquote

from tests.test_e2e import PhoneBase

STUB = "window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return null}; navigator.clipboard.writeText=async()=>{}; 0"
NUDGES = """new Promise(ok => { const r = indexedDB.open('lifeos', 1);
  r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('nudges');
  q.onsuccess = () => ok(JSON.parse(q.result || '[]')); }; })"""


class DailyUpdateTest(PhoneBase):
    def test_tap_sends_prompt_and_moves_reminder_to_tomorrow(self):
        self.pg.evaluate(STUB)
        self.add("dentist kal 4pm")
        self.pg.wait_for_function("items.size >= 1")
        self.assertIn("Jarvis daily update", self.pg.inner_text("#dailyNudge"))
        today = self.pg.evaluate("iso(todayDate())")
        self.assertIn({"date": today, "kind": "daily", "text": "☀️ Jarvis daily update: 1 tap"}, self.pg.evaluate(NUDGES))
        self.pg.click("#dailyNudge")
        prompt = unquote(self.pg.evaluate("window.__opened[0]"))
        self.assertIn("Gmail", prompt)
        self.assertIn("+ dentist kal 4pm", prompt)
        self.assertIn("LIFEOS", prompt)
        self.assertEqual(self.pg.evaluate("settings.lastDaily"), today)
        self.tab("home")
        self.assertEqual(self.pg.query_selector_all("#dailyNudge"), [])
        daily = [n for n in self.pg.evaluate(NUDGES) if n["kind"] == "daily"]
        self.assertEqual(daily[0]["date"], self.pg.evaluate("iso(addDays(todayDate(),1))"))

    def test_can_turn_off(self):
        self.tab("all")
        self.pg.uncheck("#pdaily")
        self.pg.click("#prefs button[type=submit]")
        self.tab("home")
        self.assertEqual(self.pg.query_selector_all("#dailyNudge"), [])
        self.assertFalse(self.pg.evaluate("settings.dailyOn"))


if __name__ == "__main__":
    unittest.main()
