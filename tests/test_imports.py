"""A bad import (many items saved at once) can be removed in one tap, and undone."""
import unittest

from tests.test_e2e import PhoneBase


class ImportCleanupTest(PhoneBase):
    def test_delete_and_undo_import_batch(self):
        self.pg.evaluate("""(()=>{const c=new Date().toISOString().slice(0,16)+':00';
          ['Fact one about me','Fact two about me','Fact three daily','Fact four'].forEach((t,k)=>{
            const it={id:k+1,created:c,done:false,...parse(t,todayDate())};items.set(it.id,it)});backend.save();render()})(); 0""")
        self.assertIn("4 imported items", self.pg.inner_text("#importNudge"))
        self.pg.click("#importNudge")
        self.assertIn("4 items added together", self.pg.inner_text("#imports"))
        self.pg.click("[data-batchdel]")
        self.pg.wait_for_function("items.size === 0")
        self.assertEqual(self.pg.query_selector_all("#imports"), [])
        self.pg.click("#toastUndo")
        self.pg.wait_for_function("items.size === 4")

    def test_keep_hides_batch(self):
        self.add("a 1", "b 2", "c 3")
        self.pg.wait_for_function("items.size >= 3")
        self.tab("all")
        self.pg.click("[data-batchkeep]")
        self.assertEqual(self.pg.query_selector_all("#imports"), [])
        self.assertEqual(self.pg.evaluate("items.size"), 3)

    def test_memory_prompt_says_facts_are_not_items(self):
        self.assertIn("NEVER", self.pg.evaluate("memoryPrompt()"))


if __name__ == "__main__":
    unittest.main()
