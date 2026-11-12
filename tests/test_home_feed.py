"""Home = "Jarvis found for you": chase cases first, then don't-forget, max 5; money one-liner; questions go to Jarvis."""
import unittest

from tests.test_e2e import PhoneBase


class HomeFeedTest(PhoneBase):
    def setUp(self):
        super().setUp()
        self.pg.evaluate("localStorage.setItem('lifeos.settings', '{}'); 0")  # fresh user → v4 home
        self.pg.reload()
        self.pg.wait_for_function("typeof items !== 'undefined' && backend && R2.migrated")

    def test_feed_order_and_cap(self):
        self.assertEqual(self.pg.get_attribute("body", "data-view"), "now")
        self.pg.evaluate("""(async()=>{const t=R2.todayIso();
          for(let k=0;k<5;k++)await R2.create('task',{title:'late '+k,due_date:R2.addDays(t,-1-k)});
          await R2.create('case',{title:'BrandX: speaker',seller:'BrandX',next_action:'Chase if no reply',next_action_date:R2.addDays(t,-2),waiting_on:'them'});
          render()})(); 0""")
        self.pg.wait_for_function("items.size === 6")
        rows = self.pg.eval_on_selector_all("#view .td-row, #view .td-q", "els => els.map(e => e.innerText)")
        self.assertEqual(len(rows), 5)
        self.assertIn("No reply from BrandX", rows[0])
        self.assertIn("jarvis found for you", self.pg.inner_text("#view").lower())
        self.assertIn("Bank file daalo", self.pg.inner_text("#view"))  # money one-liner when no bank data yet

    def test_question_from_home_goes_to_jarvis(self):
        self.add("passport expires 2027-03-14")
        self.pg.wait_for_function("items.size === 1")
        self.pg.fill("#q", "passport ka kya scene hai?")
        self.pg.press("#q", "Enter")
        self.pg.wait_for_function("document.body.dataset.view === 'jarvis'")
        self.assertIn("passport expires 2027-03-14", self.pg.locator(".msg.bot").last.inner_text())
        self.assertEqual(self.pg.evaluate("items.size"), 1)

    def test_daily_growth_question(self):
        self.assertIn("🌱", self.pg.inner_text("#view"))
        self.pg.click("[data-td-grow]")                                   # empty answer is not saved
        self.assertEqual(self.pg.evaluate("items.size"), 0)
        self.pg.fill("#tdGrow", "finished the tax form early")
        self.pg.click("[data-td-grow]")
        self.pg.wait_for_function("items.size === 1")
        rec = self.pg.evaluate("[...items.values()][0]")
        self.assertEqual(rec["type"], "journal")
        self.assertIn("finished the tax form early", rec["title"])
        self.assertEqual(self.pg.evaluate("settings.grow.streak"), 1)
        self.assertNotIn("🌱", self.pg.inner_text("#view"))               # once a day
        self.assertFalse(rec["due"])                                      # a note, never a reminder


if __name__ == "__main__":
    unittest.main()
