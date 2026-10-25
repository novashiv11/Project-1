"""Android share-sheet and home-screen shortcuts open the PWA with query params."""
import json
import unittest
from pathlib import Path

from tests.test_e2e import PhoneBase


class ShareAndShortcutTest(PhoneBase):
    def test_manifest_declares_share_target_and_shortcuts(self):
        m = json.loads((Path(self.dist) / "manifest.json").read_text())
        self.assertEqual(m["share_target"]["method"], "GET")
        self.assertEqual({s["url"] for s in m["shortcuts"]}, {"./?v=stack", "./?v=food", "./?v=finance", "./?v=jarvis"})

    def test_shared_text_prefills_capture_and_cleans_url(self):
        self.pg.goto(self.url + "?title=Parcel&text=Your%20DPD%20parcel%20arrives%20tomorrow&url=https%3A%2F%2Fdpd.ie%2Ft%2F1")
        self.pg.wait_for_selector("#q")
        self.assertEqual(self.pg.input_value("#q"), "Parcel Your DPD parcel arrives tomorrow https://dpd.ie/t/1")
        self.assertNotIn("?", self.pg.url)
        self.pg.press("#q", "Enter")
        self.pg.wait_for_function("items.size >= 1")
        self.assertEqual(self.pg.evaluate("[...items.values()][0].domain"), "shopping")

    def test_shortcut_opens_view(self):
        self.pg.goto(self.url + "?v=food")
        self.pg.wait_for_selector("#view")
        self.assertEqual(self.pg.get_attribute("body", "data-view"), "food")


if __name__ == "__main__":
    unittest.main()
