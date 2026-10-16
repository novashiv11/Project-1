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


class BackupNudgeTest(PhoneBase):
    def test_nudge_shows_until_backed_up(self):
        self.pg.evaluate("window.__dl = 0; HTMLAnchorElement.prototype.click = function(){ window.__dl++ }; navigator.canShare = null; 0")
        self.add("a 1", "b 2", "c 3", "d 4", "e 5")
        self.pg.wait_for_selector("#backupNudge")
        self.assertIn("Backup", self.pg.inner_text("#backupNudge"))
        self.pg.click("#backupNudge")
        self.pg.wait_for_function("!document.getElementById('backupNudge')")
        self.assertEqual(self.pg.evaluate("window.__dl"), 1)
        self.assertTrue(self.pg.evaluate("[...items.values()].every(i => i.updated)"))


if __name__ == "__main__":
    unittest.main()
