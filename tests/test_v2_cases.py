"""Cases (app/ui/cases.js) on a phone: new case → legal-window deadlines, log contact → working days, escalate, resolve/undo."""
from tests.test_e2e import PhoneBase


class CasesViewTest(PhoneBase):
    def setUp(self):
        super().setUp()
        self.pg.evaluate("R2.migrated=true; backend.save(); 0")
        self.tab("cases")

    def new_case(self, delivery="2026-10-01", return_days=""):
        self.pg.click("[data-case=new]")
        self.pg.fill("#caseform [name=seller]", "BrandX")
        self.pg.fill("#caseform [name=product]", "Headphones")
        self.pg.fill("#caseform [name=bought_where]", "RetailerY website")
        self.pg.fill("#caseform [name=delivery_date]", delivery)
        self.pg.fill("#caseform [name=price]", "89.99")
        if return_days:
            self.pg.fill("#caseform [name=return_days]", return_days)
        self.pg.fill("#caseform [name=problem]", "Left speaker dead after a week")
        self.pg.check("#caseform [name=want][value=replacement]")
        self.pg.click("#caseform [type=submit]")
        self.pg.wait_for_selector("[data-case-title]")
        return self.pg.evaluate("[...items.values()].find(i => i.type === 'case')")

    def deadlines(self):
        return self.pg.evaluate("[...items.values()].filter(i => i.type === 'deadline').sort((a, b) => a.id - b.id)")

    def case(self, cid):
        return self.pg.evaluate(f"items.get({cid})")

    def test_working_days_skip_weekend_and_bank_holiday(self):
        # Fri 23 Oct 2026 → skip Sat/Sun and Mon 26 Oct (October bank holiday) → Tue..Fri + Mon 2 Nov
        got = self.pg.evaluate("[R2.isWorkingDay(new Date(2026,9,26)), iso(R2.addWorkingDays(new Date(2026,9,23),5))]")
        self.assertEqual(got, [False, "2026-11-02"])

    def test_menu_and_new_case_creates_linked_deadlines_once(self):
        self.assertEqual(self.pg.inner_text("#title"), "Cases")
        c = self.new_case(delivery="2026-10-01", return_days="30")
        self.assertEqual(c["title"], "BrandX: Headphones")
        self.assertEqual((c["area"], c["escalation"], c["status"]), ("shopping", 1, "open"))
        self.assertEqual(c["next_action"], "Contact seller support")
        self.assertEqual(c["next_action_date"], self.pg.evaluate("R2.todayIso()"))
        self.assertTrue(c["want"].startswith("replacement"))
        dl = self.deadlines()
        self.assertEqual([d["title"] for d in dl], ["BrandX: online cancellation window ends (check your terms)",
                                                     "BrandX: return window ends (check your terms)"])
        self.assertEqual([d["date"] for d in dl], ["2026-10-15", "2026-10-31"])
        self.assertTrue(all(d["links"] == [c["id"]] and d["remind_before_days"] == 3 and d["date_known"] for d in dl))
        self.assertEqual(dl[0]["due"], "2026-10-15")  # classic reminder date in sync
        self.assertEqual(sorted(c["links"]), sorted(d["id"] for d in dl))
        self.assertIn("cancellation window", self.pg.inner_text("#view"))

        # edit the delivery date: deadlines move, never duplicate
        self.pg.click("[data-case=edit]")
        self.pg.fill("#caseform [name=delivery_date]", "2026-10-05")
        self.pg.click("#caseform [type=submit]")
        self.pg.wait_for_function("[...items.values()].some(i => i.type === 'deadline' && i.date === '2026-10-19')")
        dl = self.deadlines()
        self.assertEqual(len(dl), 2)
        self.assertEqual([d["date"] for d in dl], ["2026-10-19", "2026-11-04"])
        self.assertEqual(len(self.case(c["id"])["links"]), 2)
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)

    def test_log_contact_by_me_then_them(self):
        c = self.new_case()
        self.pg.click("[data-case=contact]")
        self.pg.select_option("#casecontact [name=channel]", "chat")
        self.pg.fill("#casecontact [name=person]", "Agent A")
        self.pg.fill("#casecontact [name=i_said]", "Asked for a replacement")
        self.pg.click("#casecontact [type=submit]")
        self.pg.wait_for_function(f"items.get({c['id']}).timeline.length === 1")
        got = self.case(c["id"])
        want5 = self.pg.evaluate("iso(R2.addWorkingDays(todayDate(),5))")
        self.assertEqual((got["waiting_on"], got["next_action"], got["next_action_date"], got["due"]), ("them", "Chase if no reply", want5, want5))
        self.assertEqual(got["timeline"][0]["by"], "me")
        self.assertEqual(got["timeline"][0]["channel"], "chat")
        self.assertEqual(got["status"], "waiting")
        self.assertIn("Agent A", self.pg.inner_text("[data-case-tl]"))

        self.pg.click("[data-case=contact]")
        self.pg.check("#casecontact [name=by][value=them]")
        self.pg.fill("#casecontact [name=they_said]", "Send photos first")
        self.pg.click("#casecontact [type=submit]")
        self.pg.wait_for_function(f"items.get({c['id']}).timeline.length === 2")
        got = self.case(c["id"])
        want2 = self.pg.evaluate("iso(R2.addWorkingDays(todayDate(),2))")
        self.assertEqual((got["waiting_on"], got["next_action"], got["next_action_date"]), ("me", "Reply", want2))
        self.assertIn("Send photos first", self.pg.inner_text("[data-case-tl] li:first-child"))  # newest first

        # evidence link, safe href
        self.pg.click("[data-case=evidence]")
        self.pg.fill("#caseev [name=ref]", "https://example.com/photo1")
        self.pg.fill("#caseev [name=note]", "fault photo")
        self.pg.click("#caseev [type=submit]")
        self.pg.wait_for_selector("[data-case-ev] a[href='https://example.com/photo1']")

    def test_overdue_case_shows_red_in_list_and_detail(self):
        c = self.new_case(delivery="")
        self.assertEqual(self.deadlines(), [])
        self.pg.evaluate(f"R2.update({c['id']}, {{next_action_date: R2.addDays(R2.todayIso(), -3)}})")
        self.pg.click("[data-case=list]")
        nxt = self.pg.query_selector(".cs-card [data-case-next]")
        self.assertIn("overdue", nxt.inner_text())
        self.assertIn("cs-late", nxt.get_attribute("class"))
        self.assertIn("Waiting on you", self.pg.inner_text(".cs-card"))
        self.pg.click(".cs-card")
        self.assertIn("overdue", self.pg.get_attribute("[data-case-nextbox]", "class"))

    def test_escalate_twice_then_resolve_and_undo(self):
        c = self.new_case()
        self.pg.click("[data-case=escalate]")
        self.pg.wait_for_function(f"items.get({c['id']}).escalation === 2")
        self.pg.click("[data-case=escalate]")
        self.pg.wait_for_function(f"items.get({c['id']}).escalation === 3")
        got = self.case(c["id"])
        self.assertEqual(got["next_action"], "File with ECC Ireland / check CCPC guidance")
        self.assertEqual(got["next_action_date"], self.pg.evaluate("R2.todayIso()"))
        self.assertIn("ECC Ireland", self.pg.inner_text(".cs-ladder li.on"))

        self.pg.click("[data-case=resolve]")
        self.assertEqual(self.case(c["id"])["status"], "open")  # needs the confirm tap
        self.pg.click("[data-case=resolve-yes]")
        self.pg.wait_for_function(f"items.get({c['id']}).status === 'done'")
        self.assertTrue(self.case(c["id"])["done"])
        self.pg.click("[data-case=list]")
        self.assertEqual(self.pg.query_selector_all("section .cs-card"), [])
        self.assertIn("Closed (1)", self.pg.inner_text("[data-case-closed] summary"))
        self.pg.click("#toastUndo")
        self.pg.wait_for_function(f"items.get({c['id']}).status === 'open'")
        self.assertEqual(self.case(c["id"])["escalation"], 3)
        self.assertEqual(len(self.pg.query_selector_all("section .cs-card")), 1)

    def test_open_case_hook_and_phone_width(self):
        c = self.new_case(return_days="30")
        self.tab("home")
        self.pg.evaluate(f"openCase({c['id']})")
        self.assertEqual(self.pg.inner_text("#title"), "Cases")
        self.assertIn("BrandX: Headphones", self.pg.inner_text("[data-case-title]"))
        self.pg.click("[data-case=contact]")
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.pg.click("[data-case=list]")
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.pg.click("[data-case=new]")
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)


if __name__ == "__main__":
    import unittest
    unittest.main()
