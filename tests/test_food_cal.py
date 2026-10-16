"""Phone: food favourites (1-tap re-log), 7-day kcal chart, calendar export matching lifeos/ics.py."""
import json
import re
import unittest

from lifeos.ics import to_ics
from tests.test_e2e import PhoneBase


class FoodAndCalendarTest(PhoneBase):
    def test_favourite_relogs_and_week_chart(self):
        self.pg.evaluate("settings.kcalGoal = '2000'; 0")
        self.add("food: Greek Yoghurt (150 g) · 146 kcal · 13.5 g protein", "lunch 650 kcal")
        self.pg.wait_for_function("items.size >= 2")
        self.tab("food")
        self.assertIn("phir se khaya", self.pg.inner_text("#view").lower())
        self.pg.click("[data-refood^='food: Greek']")
        self.pg.wait_for_function("items.size >= 3")
        self.assertEqual(self.pg.evaluate("[...items.values()].filter(i => i.text.startsWith('food: Greek')).length"), 2)
        self.assertIn("avg 942 kcal", self.pg.inner_text("#view").lower())
        self.assertEqual(self.pg.locator(".kday").count(), 7)
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)

    def test_ics_matches_python_and_gcal_link(self):
        self.add("passport expires 2027-03-14", "dentist kal 4pm", "rent every month on the 20th", "random thought")
        self.pg.wait_for_function("items.size >= 4")
        js = self.pg.evaluate("toIcs([...items.values()])")
        its = self.pg.evaluate("[...items.values()]")
        strip = lambda s: re.sub(r"DTSTAMP:\S+", "", s)
        self.assertEqual(strip(js), strip(to_ics(its)))
        self.assertEqual(js.count("BEGIN:VEVENT"), 3)
        url = self.pg.evaluate("gcalUrl([...items.values()].find(i => i.text.startsWith('rent')))")
        self.assertIn("calendar.google.com", url)
        self.assertIn("RRULE%3AFREQ%3DMONTHLY", url)
        self.tab("stack")
        self.assertTrue(self.pg.locator("a.stk-cal").first.get_attribute("href").startswith("https://calendar.google.com/"))


if __name__ == "__main__":
    unittest.main()
