"""Timeline view (app/ui/timeline.js): open dated items as nodes on one river, in a phone-sized browser."""
import unittest

from tests.test_e2e import PhoneBase

SAMPLE = ("NCT due today", "Revenue due 31 Oct 2026", "IRP card expires in 60 days",
          "passport expires 2027-03-14", "Kitchen cabinets: repaint")


class TimelineTest(PhoneBase):
    def nodes(self):
        return self.pg.eval_on_selector_all(".tl-node", "els => els.map(e => e.querySelector('b').textContent)")

    def test_nodes_in_date_order_and_undated_footer(self):
        self.add(*SAMPLE)
        self.tab("timeline")
        self.pg.wait_for_selector(".tl-node")
        dated = self.pg.evaluate("openDated([...items.values()]).map(i => i.text)")
        self.assertEqual(len(dated), 4)
        self.assertEqual(self.nodes(), dated)  # one node per date, earliest first
        self.assertNotIn("Kitchen cabinets: repaint", self.nodes())
        self.assertEqual(self.pg.inner_text(".tl-foot button"), "1 bina date wale → List")
        self.assertIn("Aaj se aage, sab ek line pe.", self.pg.inner_text(".tl-h"))
        self.assertIn("NOW", self.pg.inner_text(".tl-now"))
        smalls = self.pg.eval_on_selector_all(".tl-lab small", "els => els.map(e => e.textContent)")
        self.assertEqual(smalls[dated.index("NCT due today")], "TODAY")
        self.assertEqual(smalls[dated.index("IRP card expires in 60 days")], "WINDOW OPEN · 60D")
        ys = self.pg.eval_on_selector_all(".tl-dot", "els => els.map(e => e.getBoundingClientRect().top)")
        self.assertEqual(ys, sorted(ys))
        self.pg.click(".tl-foot button")  # global nav to the list
        self.assertEqual(self.pg.evaluate("view"), "today")

    def test_same_date_items_share_a_node(self):
        self.add("dentist kal 4pm", "call mom kal")
        self.tab("timeline")
        self.assertEqual(self.pg.locator(".tl-node").count(), 1)
        self.assertIn(" · ", self.nodes()[0])
        self.assertEqual(self.pg.inner_text(".tl-lab small"), "KAL · 2")

    def test_month_marker(self):
        self.add(*SAMPLE)
        self.tab("timeline")
        marks = self.pg.eval_on_selector_all(".tl-month", "els => els.map(e => e.textContent)")
        self.assertTrue(marks)
        self.assertIn("2027", marks)  # passport is next year

    def test_tap_expands_then_done_completes(self):
        self.add("passport expires 2027-03-14", "NCT due in 20 days")
        self.tab("timeline")
        node = self.pg.locator('.tl-node:has-text("passport")')
        self.assertEqual(node.get_attribute("aria-expanded"), "false")
        node.click()
        self.pg.wait_for_selector(".tl-detail")
        self.assertEqual(self.pg.locator('.tl-node:has-text("passport")').get_attribute("aria-expanded"), "true")
        self.assertIn("passport expires 2027-03-14", self.pg.inner_text(".tl-detail"))
        self.pg.click(".tl-detail button[data-guide]")  # guide toggles; panel stays open across re-render
        self.pg.wait_for_selector(".tl-detail .guide")
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.pg.click(".tl-detail button[data-done]")
        self.pg.wait_for_function("[...items.values()].find(i => i.text.startsWith('passport')).done")
        self.pg.wait_for_function("document.querySelectorAll('.tl-node').length === 1")
        self.assertEqual(self.nodes(), ["NCT due in 20 days"])

    def test_fits_phone_width(self):
        self.add(*SAMPLE, "a really long reminder text that keeps going and going well past the edge in 5 days")
        self.tab("timeline")
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.assertEqual(self.pg.evaluate("document.querySelector('.tl').scrollWidth <= document.querySelector('.tl').clientWidth"), True)

    def test_empty_state(self):
        self.tab("timeline")
        self.assertIn("Abhi kuch scheduled nahi. Date ke saath kuch add karo.", self.pg.inner_text(".tl"))
        self.assertEqual(self.pg.locator(".tl-node").count(), 0)
        self.assertEqual(self.pg.locator(".tl-now").count(), 1)
        self.assertEqual(self.pg.locator(".tl-svg path").count(), 3)
        self.assertEqual(self.pg.locator(".tl-foot").count(), 0)


if __name__ == "__main__":
    unittest.main()
