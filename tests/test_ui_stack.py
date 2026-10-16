"""Focus card stack (app/ui/stack.js) on a phone-sized page: queue order, done/later, XP, swipes, empty state."""
import unittest

from tests.test_e2e import PhoneBase


class StackTest(PhoneBase):
    def top(self):
        return self.pg.inner_text(".stk-card .stk-big")

    def tag(self):
        return self.pg.inner_text(".stk-card .stk-tag")

    def wait_top_not(self, text):
        self.pg.wait_for_function("t => { const e = document.querySelector('.stk-card .stk-big'); return !e || e.textContent !== t }", arg=text)

    def drag(self, dx, release=True):
        box = self.pg.locator(".stk-card").bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + 60
        self.pg.mouse.move(x, y); self.pg.mouse.down()
        for i in range(1, 11):
            self.pg.mouse.move(x + dx * i / 10, y)
        if release:
            self.pg.mouse.up()

    def item(self, text):
        return self.pg.evaluate("t => [...items.values()].find(i => i.text === t)", text)

    def test_queue_order_and_count(self):
        self.add("dentist kal 4pm", "NCT due today", "Kitchen cabinets: repaint")
        self.tab("stack")
        self.assertEqual(self.pg.inner_text("#title"), "Focus")
        self.assertEqual(self.top(), "NCT due today")
        self.assertTrue(self.tag().startswith("1 OF 3"), self.tag())
        self.assertIn("today", self.pg.inner_text(".stk-pill"))
        self.assertEqual(self.pg.locator(".stk-ghost").count(), 2)
        order = []
        for _ in range(3):  # later (⏭) walks the whole session queue
            order.append(self.top())
            self.pg.click("button[data-stk=later]")
            self.wait_top_not(order[-1])
        self.assertEqual(order[1:], ["dentist kal 4pm", "Kitchen cabinets: repaint"])
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)

    def test_done_button_gives_xp(self):
        self.add("NCT due today")
        self.tab("stack")
        self.assertIn("LVL 1", self.pg.inner_text(".stk-lv"))
        self.pg.click("button[data-stk=done]")
        self.pg.wait_for_function("[...items.values()][0].done")
        self.assertEqual(self.pg.evaluate("settings.xp"), 10)
        self.assertEqual(self.pg.evaluate("JSON.parse(localStorage.getItem('lifeos.settings')).xp"), 10)
        self.pg.wait_for_selector(".stk-empty")
        self.assertEqual(self.pg.get_attribute(".stk-xp", "aria-valuenow"), "10")
        self.pg.click("button[data-stk=undo]")  # ↺ brings the task and the XP back
        self.pg.wait_for_selector(".stk-card")
        self.assertFalse(self.item("NCT due today")["done"])
        self.assertEqual(self.pg.evaluate("settings.xp"), 0)

    def test_swipes(self):
        self.add("NCT due today", "dentist kal 4pm")
        self.tab("stack")
        self.drag(160)  # right = done
        self.pg.wait_for_function("[...items.values()].find(i => i.text === 'NCT due today').done")
        self.wait_top_not("NCT due today")
        self.assertEqual(self.top(), "dentist kal 4pm")
        self.assertTrue(self.tag().startswith("2 OF 2"), self.tag())
        before = self.item("dentist kal 4pm")["due"]
        self.drag(-160)  # left = kal tak (+1 day, time kept)
        self.pg.wait_for_function("b => [...items.values()].find(i => i.text === 'dentist kal 4pm').due !== b", arg=before)
        after = self.item("dentist kal 4pm")["due"]
        d0 = self.pg.evaluate("b => iso(addDays(fromIso(b), 1))", before)
        self.assertEqual(after, d0 + before[10:])
        self.assertFalse(self.item("dentist kal 4pm")["done"])

    def test_small_drag_snaps_back(self):
        self.add("NCT due today")
        self.tab("stack")
        self.drag(40)
        self.pg.wait_for_timeout(300)
        self.assertFalse(self.item("NCT due today")["done"])
        self.assertEqual(self.top(), "NCT due today")

    def test_stack_start_goes_first(self):
        self.add("NCT due today", "Kitchen cabinets: repaint")
        sid = self.item("Kitchen cabinets: repaint")["id"]
        self.pg.evaluate("id => { window.STACK_START = id }", sid)
        self.tab("stack")
        self.assertEqual(self.top(), "Kitchen cabinets: repaint")
        self.assertIsNone(self.pg.evaluate("window.STACK_START"))
        self.pg.evaluate("render()")  # still pinned across re-renders until acted on
        self.assertEqual(self.top(), "Kitchen cabinets: repaint")

    def test_empty_state_after_all_done(self):
        self.add("NCT due today", "Kitchen cabinets: repaint", "lunch 650 kcal")
        self.tab("stack")
        self.assertTrue(self.tag().startswith("1 OF 2"), self.tag())  # food never shows up
        for _ in range(2):
            t = self.top()
            self.pg.click("button[data-stk=done]")
            self.wait_top_not(t)
        self.pg.wait_for_selector(".stk-empty")
        self.assertIn("Sab ho gaya", self.pg.inner_text(".stk-empty"))
        self.assertEqual(self.pg.evaluate("settings.xp"), 20)
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.pg.click(".stk-empty button[data-v=home]")
        self.assertNotEqual(self.pg.evaluate("view"), "stack")

    def test_guide_card_fits_phone(self):
        self.add("IRP card expires in 60 days", "dentist kal 4pm", "NCT due in 3 days")
        self.tab("stack")
        self.assertEqual(self.top(), "IRP card expires in 60 days")  # window open beats next-7-days
        self.assertEqual(self.pg.locator(".stk-step").count(), 2)
        self.assertTrue(self.pg.eval_on_selector_all(".stk-links a", "els => els.length && els.every(e => e.target === '_blank' && e.href.startsWith('https://'))"))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.drag(85, release=False)  # mid-drag the rotated card must not widen the page
        self.assertIn("rotate", self.pg.get_attribute(".stk-card", "style"))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.pg.mouse.up()
        self.pg.wait_for_timeout(300)
        self.assertFalse(self.item("IRP card expires in 60 days")["done"])


if __name__ == "__main__":
    unittest.main()
