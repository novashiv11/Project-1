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


class ReturnFromClaudeTest(PhoneBase):
    def test_paste_nudge_ignores_own_prompt_then_reads_reply(self):
        self.pg.evaluate(STUB + "; window.__clip=''; navigator.clipboard.readText=async()=>window.__clip; 0")
        self.tab("jarvis")
        self.pg.fill("#aq", "kya pending hai?")
        self.pg.press("#aq", "Enter")
        self.pg.locator("[data-askclaude]").last.click()
        self.tab("home")
        self.pg.wait_for_selector("#pasteNudge")
        self.pg.evaluate("window.__clip = lastPrompt; 0")  # Claude reply not copied yet: our own prompt is on the clipboard
        self.pg.click("#pasteNudge")
        self.assertIn("reply copy karo", self.pg.inner_text("#toast"))
        self.assertIsNone(self.pg.evaluate("pasteResult"))
        self.pg.evaluate("window.__clip = 'Sure!\\nLIFEOS\\n+ dentist 3 nov 10am\\nlearn: prefers mornings'; 0")
        self.pg.click("#pasteNudge")
        self.pg.click("[data-paste=apply]")
        self.pg.wait_for_function("items.size >= 1")
        self.assertEqual(self.pg.query_selector_all("#pasteNudge"), [])
        self.assertIn("prefers mornings", self.pg.evaluate("settings.lifeContext"))

    def test_weekly_review_button(self):
        self.pg.evaluate(STUB)
        self.add("gym every monday 7am")
        self.tab("review")
        self.pg.click("[data-weekly]")
        prompt = unquote(self.pg.evaluate("window.__opened[0]"))
        self.assertIn("?q=Weekly review for my LifeOS", prompt)
        self.assertIn("+ gym every monday 7am", prompt)

    def test_focus_skips_old_undated_notes(self):
        self.pg.evaluate("""(()=>{const old={id:1,created:'2025-01-01T09:00:00',done:false,...parse('old random thought',todayDate())};
          items.set(1,old);backend.save()})(); 0""")
        self.add("fresh random thought")
        self.pg.wait_for_function("items.size >= 2")
        self.tab("stack")
        txt = self.pg.inner_text("#view")
        self.assertIn("fresh random thought", txt)
        self.assertNotIn("old random thought", txt)


if __name__ == "__main__":
    unittest.main()
