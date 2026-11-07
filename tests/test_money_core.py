"""Money core (app/ui/money-core.js) in node: Revolut/bank CSV parsing, de-dup, pending → completed,
internal-transfer and saving detection, refund netting, tie-out, projections and merchant frequency."""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REVOLUT = """Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-10-02 10:00:00,2026-10-03 09:00:00,Tesco Stores 3456,-50.00,0.00,EUR,COMPLETED,950.00
CARD_PAYMENT,Current,2026-10-04 12:00:00,2026-10-05 09:00:00,Amazon.ie*AB12,-100.00,0.00,EUR,COMPLETED,850.00
CARD_REFUND,Current,2026-10-09 12:00:00,2026-10-10 09:00:00,Amazon.ie*XY99,40.00,0.00,EUR,COMPLETED,890.00
CARD_PAYMENT,Current,2026-10-06 12:00:00,,Just Eat,-20.00,0.00,EUR,PENDING,
CARD_PAYMENT,Current,2026-10-07 12:00:00,2026-10-07 13:00:00,Broken Shop,-999.00,0.00,EUR,REVERTED,
TOPUP,Current,2026-10-01 08:00:00,2026-10-01 08:00:00,Payment from Bank Account,200.00,0.00,EUR,COMPLETED,1000.00
EXCHANGE,Current,2026-10-08 08:00:00,2026-10-08 08:00:00,Exchanged to INR,-100.00,0.00,EUR,COMPLETED,790.00
EXCHANGE,Current,2026-10-08 08:00:00,2026-10-08 08:00:00,Exchanged from EUR,9500.00,0.00,INR,COMPLETED,9500.00
TRANSFER,Current,2026-10-12 08:00:00,2026-10-12 08:00:00,To Trading 212,-300.00,0.00,EUR,COMPLETED,490.00
TRANSFER,Current,2026-10-13 08:00:00,2026-10-13 08:00:00,To Asha Example,-60.00,0.00,EUR,COMPLETED,430.00
CARD_PAYMENT,Current,2026-10-14 08:00:00,2026-10-14 08:00:00,Tesco Stores 3456,-25.00,0.50,EUR,COMPLETED,404.50
CARD_PAYMENT,Current,2026-10-14 08:00:00,2026-10-14 08:00:00,Tesco Stores 3456,-25.00,0.50,EUR,COMPLETED,379.00
"""
BANK = """Date,Details,Debit,Credit,Balance
01/10/2026,SALARY EXAMPLE CORP LTD,,3000.00,3500.00
01/10/2026,BANK MORTGAGE DD,1200.00,,2300.00
01/10/2026,REVOLUT**1234,200.00,,2100.00
"""

HARNESS = r"""
const M=require(process.argv[2]); const S=M.defaultSettings(); S.myNames=["Asha Example"];
const out={};
const rev=M.parseRevolut(require("fs").readFileSync(process.argv[3],"utf8"));
const bank=M.parseBank(require("fs").readFileSync(process.argv[4],"utf8"),"BOI Current");
out.revCount=rev.length; out.pending=rev.filter(t=>t.state==="pending").length; out.accounts=[...new Set(rev.map(t=>t.account))];
let r=M.merge({txns:[]},rev,S); out.first={added:r.added,dupes:r.dupes};
r=M.merge(r.db,M.parseRevolut(require("fs").readFileSync(process.argv[3],"utf8")),S); out.again={added:r.added,dupes:r.dupes};
// pending → completed
const done=M.parseRevolut(require("fs").readFileSync(process.argv[3],"utf8").replace(",,Just Eat,-20.00,0.00,EUR,PENDING,",",2026-10-07 09:00:00,Just Eat,-20.00,0.00,EUR,COMPLETED,359.00"));
r=M.merge(r.db,done,S); out.completed={added:r.added,updated:r.updated};
const db1=r.db; // Revolut only
const kind=d=>db1.txns.filter(t=>t.desc===d).map(t=>[t.kind,t.category]);
out.kinds={tesco:kind("Tesco Stores 3456")[0],topup:kind("Payment from Bank Account")[0],exch:kind("Exchanged to INR")[0],
  t212:kind("To Trading 212")[0],me:kind("To Asha Example")[0],refund:kind("Amazon.ie*XY99")[0]};
out.refundLinked=!!db1.txns.find(t=>t.desc==="Amazon.ie*XY99").refundOf;
out.twoSameDay=db1.txns.filter(t=>t.date==="2026-10-14").length;
out.fee=db1.txns.find(t=>t.date==="2026-10-14").amountEur;
const tot=M.monthTotals(db1.txns,"2026-10",S); out.amazon=tot.byCat.Amazon; out.spend=tot.spend; out.save=tot.save;
out.tieRevOnly=M.tieOut(db1.txns,"2026-10",S);
r=M.merge(db1,bank,S); const db2=r.db;
out.bankKinds=db2.txns.filter(t=>t.account==="BOI Current").map(t=>[t.desc,t.kind,t.category]);
out.tieBoth=M.tieOut(db2.txns,"2026-10",S);
const dash=M.dashboard(db2.txns,S,"2026-10-15"); out.projected=dash.projected; out.savingsRate=dash.savingsRate;
out.drillAmazon=M.filterTxns(db2.txns,{month:"2026-10",category:"Amazon"},S).length;
// learning: recategorise all from a merchant, then a new import follows the rule
const n=M.recategorise(db2,db2.txns.find(t=>t.desc==="Tesco Stores 3456").id,"Gifts/family",S,true);
const r3=M.merge(db2,M.parseRevolut("Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\nCARD_PAYMENT,Current,2026-10-20 10:00:00,2026-10-20 10:00:00,Tesco Stores 9999,-10.00,0,EUR,COMPLETED,1\n"),S);
out.learned={n,newCat:r3.db.txns.find(t=>t.desc==="Tesco Stores 9999").category};
// merchant frequency
const many=[];for(let i=0;i<52;i++){const d=new Date(2025,10,8+i*7);many.push({source:"bank",account:"A",started:d.toISOString().slice(0,10),date:d.toISOString().slice(0,10),desc:"Vape Shop "+i,amount:-25,fee:0,currency:"EUR",state:"completed",rtype:""})}
const r4=M.merge({txns:[]},many,S); const ms=M.merchantStats(r4.db.txns,"2026-11-05"); out.vape=[ms[0].merchant,ms[0].count,ms[0].avg,ms[0].yearly,r4.db.txns[0].category];
out.dates=[M.normalizeDate("05/10/2026"),M.normalizeDate("2026-10-05 14:00:00"),M.normalizeDate("5 Oct 2026")];
console.log(JSON.stringify(out));
"""


@unittest.skipUnless(shutil.which("node"), "node not installed")
class MoneyCoreTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            (t / "rev.csv").write_text(REVOLUT)
            (t / "bank.csv").write_text(BANK)
            (t / "h.js").write_text(HARNESS)
            res = subprocess.run(["node", "h.js", str(ROOT / "app/ui/money-core.js"), "rev.csv", "bank.csv"],
                                 cwd=tmp, capture_output=True, text=True)
            if res.returncode:
                raise AssertionError(res.stderr)
            cls.o = json.loads(res.stdout)

    def test_revolut_parse_skips_reverted_and_keeps_pending_apart(self):
        self.assertEqual(self.o["revCount"], 11)
        self.assertEqual(self.o["pending"], 1)
        self.assertEqual(set(self.o["accounts"]), {"Revolut EUR", "Revolut INR"})

    def test_dedupe_and_pending_to_completed(self):
        self.assertEqual(self.o["first"]["added"], 11)
        self.assertEqual(self.o["again"], {"added": 0, "dupes": 11})
        self.assertEqual(self.o["completed"], {"added": 0, "updated": 1})
        self.assertEqual(self.o["twoSameDay"], 2)  # two identical coffees on one day are both real
        self.assertEqual(self.o["fee"], -25.5)    # fee counts in the cost

    def test_kinds(self):
        k = self.o["kinds"]
        self.assertEqual(k["tesco"], ["SPEND", "Groceries"])
        self.assertEqual(k["topup"][0], "INTERNAL")
        self.assertEqual(k["exch"][0], "INTERNAL")
        self.assertEqual(k["t212"], ["SAVE", "Saving"])
        self.assertEqual(k["me"][0], "INTERNAL")   # "To <my name>"
        self.assertEqual(k["refund"], ["SPEND", "Amazon"])
        bank = {d: (kind, cat) for d, kind, cat in self.o["bankKinds"]}
        self.assertEqual(bank["SALARY EXAMPLE CORP LTD"][0], "INCOME")
        self.assertEqual(bank["BANK MORTGAGE DD"], ("SPEND", "Mortgage"))
        self.assertEqual(bank["REVOLUT**1234"][0], "INTERNAL")

    def test_refund_nets_against_purchase(self):
        self.assertTrue(self.o["refundLinked"])
        self.assertEqual(self.o["amazon"], 60)

    def test_tie_out(self):
        rev = self.o["tieRevOnly"]
        self.assertNotEqual(rev["gap"], 0)  # Revolut alone: the top-up's other side is missing → gap shown
        both = self.o["tieBoth"]
        self.assertEqual(both["left"], round(both["income"] - both["spend"] - both["save"], 2))
        # Bank −200 → Revolut +200 cancel and EUR→INR nets to the rate difference; the €60 "To <my name>" transfer
        # has no imported other side, so it is the gap (and listed)
        self.assertAlmostEqual(both["gap"], -60.25, places=2)
        self.assertEqual(len(both["gapRows"]), 5)  # top-up, bank→Revolut, 2× exchange, to-me

    def test_dashboard_and_drill(self):
        self.assertGreater(self.o["projected"], 0)
        self.assertEqual(self.o["savingsRate"], 10.0)  # 300 saved of 3000 income
        self.assertEqual(self.o["drillAmazon"], 2)

    def test_learning_rule(self):
        self.assertEqual(self.o["learned"]["newCat"], "Gifts/family")
        self.assertGreaterEqual(self.o["learned"]["n"], 2)

    def test_merchant_frequency(self):
        merchant, count, avg, yearly, cat = self.o["vape"]
        self.assertEqual((count, avg, cat), (52, 25, "Vape/smoke"))
        self.assertTrue(1250 <= yearly <= 1350)

    def test_dates(self):
        self.assertEqual(self.o["dates"], ["2026-10-05"] * 3)


if __name__ == "__main__":
    unittest.main()
