"""My words: personal names (pet, people, shops) set on the phone re-file items into the right area."""
import unittest

from tests.test_e2e import PhoneBase


class MyWordsTest(PhoneBase):
    def domains(self):
        return self.pg.evaluate("Object.fromEntries([...items.values()].map(i => [i.text, i.domain]))")

    def test_pet_name_files_old_and_new_items_under_pets(self):
        self.add("Bruno ko meds dede", "spent 40 at Tesco")
        self.pg.wait_for_function("items.size >= 2")
        self.assertEqual(self.domains()["Bruno ko meds dede"], "health")
        self.tab("all")
        self.pg.fill("#pwords", "Bruno = pet\nTesco = money")
        self.pg.click("#prefs button[type=submit]")
        self.pg.wait_for_function("[...items.values()].some(i => i.domain === 'pet')")
        self.assertIn("1 item moved", self.pg.inner_text("body"))
        self.tab("home")
        self.add("Bruno weight 24kg")
        self.pg.wait_for_function("items.size >= 3")
        got = self.domains()
        self.assertEqual(got["Bruno ko meds dede"], "pet")
        self.assertEqual(got["Bruno weight 24kg"], "pet")
        self.assertEqual(self.pg.evaluate("[...items.values()].find(i => i.text === 'Bruno weight 24kg').metrics[0].name"), "pet.weight")
        self.pg.reload()  # survives a restart: settings re-apply on load
        self.pg.wait_for_function("typeof items !== 'undefined' && items.size >= 3")
        self.assertEqual(self.pg.evaluate("parse('Bruno vet kal', todayDate()).domain"), "pet")


if __name__ == "__main__":
    unittest.main()
