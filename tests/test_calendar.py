"""Phone: calendar export (.ics) matches lifeos/ics.py; Google Calendar link."""
import json
import re
import unittest

from lifeos.ics import to_ics
from tests.test_e2e import PhoneBase


class CalendarTest(PhoneBase):
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


if __name__ == "__main__":
    unittest.main()
