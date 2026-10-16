"""Money view (app/ui/finance.js) on a phone: spending total, fixed bills, tax deadlines, CA check-up, Ask-my-CA."""
import os
import unittest
from urllib.parse import unquote

from tests.test_e2e import PhoneBase

SHOT = "/tmp/claude-0/-home-user/2abaf32b-9193-5bf5-abad-bec5c7bfed24/scratchpad/agent-finance.png"
STUB = "window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return null}; navigator.clipboard.writeText=async()=>{}; 0"


class FinanceViewTest(PhoneBase):
    def put(self, *texts):
        n = len(self.items()) + len(texts)
        self.add(*texts)
        self.pg.wait_for_function(f"items.size >= {n}")

    def view(self):
        return self.pg.inner_text("#view")

    def test_spending_total_this_month(self):
        self.put("spent €45 at tesco", "spent €20 on lunch")
        self.tab("finance")
        self.assertEqual(self.pg.inner_text("#title"), "Money")
        self.assertIn("€65", self.pg.inner_text("[data-fin-total]"))
        self.assertIn("first month tracked", self.view())

    def test_empty_state_shows_how_to_log(self):
        self.tab("finance")
        self.assertIn("spent €45 at tesco", self.view())

    def test_recurring_bill_listed_as_fixed(self):
        self.put("Eir bill every month on the 5th", "Netflix €12.99 each month")
        self.tab("finance")
        self.assertIn("€0", self.pg.inner_text("[data-fin-total]"))  # bills are fixed costs, not spending
        fixed = self.pg.inner_text("[data-fin-fixed]")
        self.assertIn("Eir bill every month on the 5th", fixed)
        self.assertIn("€12.99", fixed)

    def test_deadline_tick_completes_it(self):
        self.put("Revenue self-assessment due 31 Oct 2026")
        self.tab("finance")
        box = "[data-fin-deadlines]"
        self.assertIn("Revenue self-assessment due 31 Oct 2026", self.pg.inner_text(box))
        self.pg.click(f"{box} [data-done]")
        self.pg.wait_for_function("[...items.values()].every(i => i.done)")
        self.assertNotIn("Revenue self-assessment", self.pg.inner_text(box))

    def test_add_to_my_list(self):
        self.tab("finance")
        self.pg.click("[data-fin-add='rent']")
        self.pg.wait_for_function("items.size === 1")
        self.assertIn("rent tax credit", self.items()[0])
        self.assertIn("Added", self.pg.inner_text("#toast"))

    def test_ask_my_ca_opens_claude_with_prompt(self):
        self.put("Revenue self-assessment due 31 Oct 2026", "spent €45 at tesco")
        self.tab("finance")
        self.pg.evaluate(STUB)
        self.pg.click("[data-fin-ask='ca']")
        url = self.pg.evaluate("window.__opened[0]")
        self.assertTrue(url.startswith("https://claude.ai/new?q="), url)
        prompt = unquote(url.split("?q=", 1)[1])
        self.assertIn("LIFEOS", prompt)
        self.assertIn("Revenue self-assessment due 31 Oct 2026", prompt)
        self.assertIn("€45", prompt)
        self.assertIn("professional", prompt)
        self.tab("finance")
        self.pg.evaluate(STUB)
        self.pg.click("[data-fin-ask='import']")
        imp = unquote(self.pg.evaluate("window.__opened[0]").split("?q=", 1)[1])
        self.assertIn("past conversations", imp)
        self.assertIn("LIFEOS", imp)

    def test_links_are_safe_and_fits_phone(self):
        self.put("spent €45 at tesco", "Eir bill €45 every month on the 5th", "Revenue self-assessment due 31 Oct 2026",
                 "<img src=x onerror=alert(1)> spent €3")
        self.tab("finance")
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.assertEqual(self.pg.evaluate("document.querySelectorAll('#view img').length"), 0)
        bad = self.pg.evaluate("[...document.querySelectorAll('#view a')].filter(a => a.target !== '_blank' "
                               "|| !a.rel.includes('noopener') || !a.getAttribute('aria-label')).length")
        self.assertEqual(bad, 0)
        self.assertTrue(self.pg.evaluate("[...document.querySelectorAll('#view a')].every(a => /^https:\\/\\/www\\.(revenue|citizensinformation)\\.ie\\//.test(a.href))"))
        if os.path.isdir(os.path.dirname(SHOT)):
            ctx = self.browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = ctx.new_page()
            pg.goto(self.url)
            pg.wait_for_function("typeof items !== 'undefined' && backend")
            for t in ("spent €45 at tesco", "spent €20 on lunch", "spent €62.50 at aldi", "Eir bill €45 every month on the 5th",
                      "Netflix €12.99 each month", "Revenue self-assessment due 31 Oct 2026", "car insurance renew 20 Nov"):
                pg.fill("#q", t); pg.press("#q", "Enter")
            pg.wait_for_function("items.size >= 7")
            pg.click("#more"); pg.click("#tab-finance")
            pg.wait_for_timeout(400)
            pg.evaluate("document.getElementById('toast').hidden = true")
            pg.screenshot(path=SHOT)
            ctx.close()


if __name__ == "__main__":
    unittest.main()
