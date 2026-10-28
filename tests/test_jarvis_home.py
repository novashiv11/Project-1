"""Jarvis is home: tell it things (saved), ask it things (answered from your own list + life notes), deeper → Claude."""
import unittest
from urllib.parse import unquote

from tests.test_e2e import PhoneBase

STUB = "window.__opened=[]; window.open=(u)=>{window.__opened.push(u);return null}; navigator.clipboard.writeText=async()=>{}; 0"


class JarvisHomeTest(PhoneBase):
    def setUp(self):
        super().setUp()
        self.pg.evaluate("localStorage.setItem('lifeos.settings', '{}'); 0")  # a fresh user: Jarvis home
        self.pg.reload()
        self.pg.wait_for_function("typeof items !== 'undefined' && backend")
        self.pg.evaluate(STUB)

    def say(self, t):
        self.pg.fill("#aq", t)
        self.pg.press("#aq", "Enter")

    def last_bot(self):
        return self.pg.locator(".msg.bot").last.inner_text()

    def test_home_is_jarvis_and_menu_is_short(self):
        self.assertEqual(self.pg.get_attribute("body", "data-view"), "jarvis")
        self.pg.click("#more")
        self.assertTrue(self.pg.is_visible("#tab-list"))
        self.assertFalse(self.pg.is_visible("#tab-food"))
        self.pg.click("#moretools")
        self.assertTrue(self.pg.is_visible("#tab-food"))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)

    def test_tell_then_ask(self):
        self.say("passport expires 2027-03-14")
        self.pg.wait_for_function("items.size === 1")
        self.assertIn("Yaad rakh liya", self.last_bot())
        self.say("spent €40 at tesco")
        self.say("passport ka kya scene hai?")
        self.assertIn("passport expires 2027-03-14", self.last_bot())
        self.assertEqual(self.pg.evaluate("items.size"), 2)  # questions are not saved
        self.say("is mahine kitna kharcha hua?")
        self.assertIn("€40", self.last_bot())
        self.pg.locator("[data-askclaude]").last.click()
        self.assertIn("kitna kharcha", unquote(self.pg.evaluate("window.__opened[0]")))

    def test_chips_and_life_facts(self):
        self.pg.evaluate("settings.lifeContext='## Pets\\n- Dog Bruno, eats kibble with meat'; 0")
        self.pg.click("[data-ask='Mere baare mein kya jaante ho?']")
        self.assertIn("Dog Bruno", self.last_bot())
        self.say("Bruno kya khata hai?")
        self.assertIn("kibble", self.last_bot())


if __name__ == "__main__":
    unittest.main()
