"""Money screen on a phone: import Revolut + bank CSVs, dashboard numbers, drill-down, learn a category,
encrypted at rest (nothing readable in storage), survives reload, export."""
import calendar
import unittest
from datetime import date
from pathlib import Path

from tests.test_e2e import PhoneBase

T = date.today()
M = f"{T.year}-{T.month:02d}"
D = lambda d: f"{M}-{min(d, T.day):02d}"
REV = f"""Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
TOPUP,Current,{D(1)} 08:00:00,{D(1)} 08:00:00,Payment from Bank Account,300.00,0.00,EUR,COMPLETED,300.00
CARD_PAYMENT,Current,{D(1)} 10:00:00,{D(1)} 10:00:00,Tesco Stores 3456,-80.00,0.00,EUR,COMPLETED,220.00
CARD_PAYMENT,Current,{D(1)} 12:00:00,{D(1)} 12:00:00,Amazon.ie*AB12,-120.00,0.00,EUR,COMPLETED,100.00
TRANSFER,Current,{D(1)} 13:00:00,{D(1)} 13:00:00,To Trading 212,-50.00,0.00,EUR,COMPLETED,50.00
CARD_PAYMENT,Current,{D(1)} 14:00:00,,Just Eat,-15.00,0.00,EUR,PENDING,
"""
BANK = f"""Date,Details,Debit,Credit,Balance
{D(1)[8:]}/{D(1)[5:7]}/{D(1)[:4]},SALARY EXAMPLE CORP LTD,,2500.00,2500.00
{D(1)[8:]}/{D(1)[5:7]}/{D(1)[:4]},BANK MORTGAGE DD,1100.00,,1400.00
{D(1)[8:]}/{D(1)[5:7]}/{D(1)[:4]},REVOLUT**1234,300.00,,1100.00
"""


class MoneyScreenTest(PhoneBase):
    def setUp(self):
        super().setUp()
        (Path(self.tmp) / "rev.csv").write_text(REV)
        (Path(self.tmp) / "bank.csv").write_text(BANK)
        self.tab("money")
        self.pg.wait_for_selector("#mnFile", state="attached")

    def imp(self, *names):
        self.pg.set_input_files("#mnFile", [str(Path(self.tmp) / n) for n in names])
        self.pg.wait_for_selector(".mn-big")

    def test_import_dashboard_drill_learn_persist(self):
        self.imp("rev.csv", "bank.csv")
        self.pg.wait_for_function("EXTRA_VIEWS.money._test.S.txns.length === 8")
        view = self.pg.inner_text("#view").lower()
        self.assertIn("€1300", view.replace(",", ""))          # spent: 80 + 120 + 1100
        self.assertIn("✓ €0 gap", view)                         # bank → Revolut top-up nets out
        self.assertIn("€15 pending", view)
        self.assertIn("\n2.0%\n", view)                           # saved 50 of 2500
        self.assertNotIn("what changed", view)                  # no history yet → nothing to compare
        dim = calendar.monthrange(T.year, T.month)[1]
        proj = f"€{round(1100 + 200 / T.day * dim):,}"            # month-end: mortgage once + the rest at today's pace
        self.assertIn(proj, self.pg.inner_text("#view"))
        # drill: tap the Amazon category, recategorise, learn the rule
        self.pg.locator(".mn-bar .mn-n", has_text="Amazon").click()
        self.assertIn("Amazon.ie*AB12", self.pg.inner_text(".mn-drill"))
        self.pg.select_option("select[data-mn-cat]", "Electronics")
        self.pg.wait_for_function("EXTRA_VIEWS.money._test.S.settings.rules['amazon'] === 'Electronics'")
        # encrypted at rest: nothing readable in localStorage or IndexedDB
        self.assertNotIn("Tesco", self.pg.evaluate("JSON.stringify(localStorage)"))
        raw = self.pg.evaluate("""new Promise(ok=>{const r=indexedDB.open('lifeos-money',1);r.onsuccess=()=>{
            const q=r.result.transaction('kv').objectStore('kv').get('data');q.onsuccess=()=>ok(new TextDecoder().decode(q.result.ct).includes('Tesco'))}})""")
        self.assertFalse(raw)
        self.pg.reload()
        self.pg.wait_for_function("typeof items !== 'undefined' && backend")
        self.tab("money")
        self.pg.wait_for_selector(".mn-big")
        self.assertIn("Electronics", self.pg.inner_text("#view"))
        self.assertEqual(self.pg.evaluate("document.documentElement.scrollWidth"), 390)

    def test_reimport_is_deduplicated(self):
        self.imp("rev.csv")
        self.pg.wait_for_function("EXTRA_VIEWS.money._test.S.txns.length === 5")
        self.imp("rev.csv")
        self.pg.wait_for_function("document.getElementById('toastMsg').textContent.includes('already there')")
        self.assertEqual(self.pg.evaluate("EXTRA_VIEWS.money._test.S.txns.length"), 5)

    def test_gap_is_shown_and_tappable(self):
        self.imp("rev.csv")  # top-up without the bank side
        self.pg.wait_for_selector("text=gap")
        self.pg.locator(".mn-tie .mn-warn").click()
        self.assertIn("Payment from Bank Account", self.pg.inner_text(".mn-drill"))

    def test_manual_entry_and_export(self):
        self.pg.click("[data-mn-manual]")
        self.pg.fill("#mnDesc", "Plumber cash")
        self.pg.fill("#mnAmt", "90")
        self.pg.click("#mnManual button[type=submit]")
        self.pg.wait_for_function("EXTRA_VIEWS.money._test.S.txns.length === 1")
        self.pg.click("[data-mn-settings]")
        csv = self.pg.evaluate("MoneyCore.toCSV(EXTRA_VIEWS.money._test.S.txns)")
        self.assertIn("Plumber cash,-90", csv)


class MoneyFilesTest(PhoneBase):
    """The import button also takes the tracker .xlsx (Ledger sheet) and an ESB smart-meter file."""
    def test_xlsx_ledger_and_esb(self):
        from tests.test_money_import import make_xlsx, hdf, native
        from datetime import date as _d, timedelta
        xp, ep = Path(self.tmp) / "tracker.xlsx", Path(self.tmp) / "esb.csv"
        make_xlsx(xp)
        ep.write_text(hdf([_d(2026, 10, 1) + timedelta(days=i) for i in range(10)], native)[0])
        self.tab("money")
        self.pg.wait_for_selector("#mnFile", state="attached")
        self.pg.set_input_files("#mnFile", [str(xp)])
        self.pg.wait_for_function("EXTRA_VIEWS.money._test.S.txns.length > 0")
        kinds = self.pg.evaluate("[...new Set(EXTRA_VIEWS.money._test.S.txns.map(t => t.kind))].sort()")
        self.assertIn("SPEND", kinds)
        self.assertIn("INCOME", kinds)
        self.assertTrue(self.pg.evaluate("Object.keys(EXTRA_VIEWS.money._test.S.settings.rules).length > 0"))  # rules learned from the tracker
        self.pg.set_input_files("#mnFile", [str(ep)])
        self.pg.wait_for_function("EXTRA_VIEWS.money._test.S.esb && EXTRA_VIEWS.money._test.S.esb.daily.length >= 8")


if __name__ == "__main__":
    unittest.main()
