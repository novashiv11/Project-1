"""Orb home (app/ui/orb.js): breathing orb + urgent-item bubbles, phone sized. Runs in headless Chromium."""
import unittest

from tests.test_e2e import PhoneBase


class OrbHomeTest(PhoneBase):
    def home(self):
        self.pg.evaluate("view = HOME; render()")

    def test_orb_bubbles_and_fit(self):
        self.pg.evaluate("settings.name = 'Shivam'")
        self.add("IRP card expires in 60 days", "dentist kal 4pm", "NCT due today", "lunch 650 kcal")
        self.home()
        self.assertEqual(self.pg.evaluate("view"), "orb")
        self.assertTrue(self.pg.is_visible(".o3k-orb"))
        bubs = self.pg.eval_on_selector_all(".o3k-bub", "els => els.map(e => e.innerText)")
        self.assertEqual(len(bubs), 3)
        text = " ".join(bubs)
        for want in ("NCT", "today", "dentist", "kal", "IRP", "start now"):
            self.assertIn(want, text)
        self.assertNotIn("lunch", text)  # food never floats
        self.assertTrue(bubs[0].startswith("NCT"))  # due today ranks before the open renewal window
        say = self.pg.inner_text(".o3k-say")
        self.assertIn("Shivam", say)
        self.assertIn("2 cheezein", say)  # today + window open; kal waits for the week
        self.assertTrue(self.pg.is_visible(".o3k-go"))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        inside = self.pg.evaluate("""(() => { const s = document.querySelector('.o3k-stage').getBoundingClientRect();
          return [...document.querySelectorAll('.o3k-bub')].every(b => { const r = b.getBoundingClientRect();
            return r.left >= s.left - 0.5 && r.right <= s.right + 0.5; }); })()""")
        self.assertTrue(inside)

    def test_bubble_tap_navigates_and_sets_stack_start(self):
        self.add("NCT due today", "dentist kal 4pm")
        self.home()
        nid = self.pg.evaluate("[...items.values()].find(i => i.text.startsWith('dentist')).id")
        # record every write: the stack view (if present) reads STACK_START and clears it
        self.pg.evaluate("""window.__starts = []; let v; Object.defineProperty(window, 'STACK_START',
          {configurable: true, get: () => v, set: x => { v = x; window.__starts.push(x); }})""")
        self.pg.click('.o3k-bub:has-text("dentist")')
        self.assertNotEqual(self.pg.evaluate("view"), "orb")
        self.assertEqual(self.pg.evaluate("window.__starts[0]"), nid)

    def test_empty_state(self):
        self.assertEqual(self.pg.evaluate("view"), "orb")
        self.assertIn("Mujhe kuch bhi batao", self.pg.inner_text("#view"))
        self.assertFalse(self.pg.is_visible(".o3k-go"))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)

    def test_all_clear_line(self):
        self.add("passport expires 2030-03-14")
        self.home()
        self.assertIn("Sab clear", self.pg.inner_text(".o3k-say"))
        self.assertEqual(self.pg.locator(".o3k-bub").count(), 0)

    def test_list_link_and_orb_tap(self):
        self.add("NCT due today")
        self.home()
        self.pg.click('.o3k-links button:has-text("List")')
        self.assertEqual(self.pg.evaluate("view"), "today")
        self.assertIn("Aaj", self.pg.text_content("#view"))
        self.home()
        self.pg.click(".o3k-orb")
        self.assertEqual(self.pg.evaluate("view"), self.pg.evaluate("EXTRA_VIEWS.stack ? 'stack' : 'today'"))

    def test_long_press_orb_opens_typing(self):
        self.pg.evaluate("document.getElementById('mic').hidden = true")
        box = self.pg.locator(".o3k-orb").bounding_box()
        self.pg.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        self.pg.mouse.down()
        self.pg.wait_for_timeout(600)
        self.assertIn("listening", self.pg.get_attribute(".o3k-orb", "class"))
        self.pg.mouse.up()
        self.assertEqual(self.pg.evaluate("document.activeElement.id"), "q")
        self.assertEqual(self.pg.evaluate("view"), "orb")  # a hold is not a tap


if __name__ == "__main__":
    unittest.main()
