"""Money import parsers (app/ui/money-xlsx.js, app/ui/money-esb.js) run under node.

Fixtures are synthetic: generic accounts/merchants, a made-up MPRN and meter serial."""
import json
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
XLSX_JS = ROOT / "app" / "ui" / "money-xlsx.js"
ESB_JS = ROOT / "app" / "ui" / "money-esb.js"

HARNESS = r"""
const fs = require("fs");
const [,, mode, mod, input] = process.argv;
const API = require(mod);
(async () => {
  let out;
  if (mode === "xlsx") {
    const sheets = await API.readSheets(fs.readFileSync(input));
    out = { sheets, ledger: API.ledgerToTxns(sheets.Ledger),
            dates: [1, 59, 60, 61, 45000, 45930.75].map(API.excelDate),
            global: typeof globalThis.MoneyXLSX.readSheets };
  } else {
    out = API.parseHDF(fs.readFileSync(input, "utf8"));
  }
  process.stdout.write(JSON.stringify(out));
})().catch((e) => { console.error(e); process.exit(1); });
"""


def serial(d):
    return (d - date(1899, 12, 30)).days


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def make_xlsx(path):
    shared = ["Date", "Account", "Description", "Amount", "Category", "Type", "Group",
              "Essential/Flexible", "Note", "Current", "Grocery Shop", "Groceries", "SPEND", "Food",
              "Essential", "Salary", "INCOME", "Savings", "Rainy day", "Flexible", "Cafe & Bakery", "SAVE"]
    sst = "".join(f"<si><t>{esc(s)}</t></si>" for s in shared)
    # plus one rich-text string made of two <r><t> runs
    sst += '<si><r><rPr><b/></rPr><t>Monthly </t></r><r><t xml:space="preserve">transfer</t></r></si>'
    S = {s: i for i, s in enumerate(shared)}
    S["Monthly transfer"] = len(shared)

    def s(col, row, text):
        return f'<c r="{col}{row}" t="s"><v>{S[text]}</v></c>'

    def n(col, row, val):
        return f'<c r="{col}{row}"><v>{val}</v></c>'

    def inl(col, row, text):
        return f'<c r="{col}{row}" t="inlineStr"><is><t>{esc(text)}</t></is></c>'

    rows = []
    hdr = "ABCDEFGHI"
    rows.append('<row r="1">' + "".join(s(c, 1, h) for c, h in zip(hdr, shared[:9])) + "</row>")
    # 2: serial date, positive SPEND -> negated, Essential
    rows.append('<row r="2">' + n("A", 2, serial(date(2026, 9, 1))) + s("B", 2, "Current")
                + s("C", 2, "Grocery Shop") + n("D", 2, "42.5") + s("E", 2, "Groceries")
                + s("F", 2, "SPEND") + s("G", 2, "Food") + s("H", 2, "Essential") + "</row>")
    # 3: text date dd/mm/yyyy, income, lower-case type, blank essential
    rows.append('<row r="3">' + inl("A", 3, "25/09/2026") + s("B", 3, "Current") + s("C", 3, "Salary")
                + n("D", 3, "3100") + s("E", 3, "Salary") + inl("F", 3, "income") + "</row>")
    # 4: empty row (skipped)
    rows.append('<row r="4"></row>')
    # 5: ISO text date, SAVE positive -> negated, Flexible, note
    rows.append('<row r="5">' + inl("A", 5, "2026-09-26") + s("B", 5, "Current") + s("C", 5, "Rainy day")
                + n("D", 5, "200") + s("E", 5, "Savings") + s("F", 5, "SAVE") + s("H", 5, "Flexible")
                + inl("I", 5, "auto <monthly>") + "</row>")
    # 6: INTERNAL keeps sign, rich text description
    rows.append('<row r="6">' + n("A", 6, serial(date(2026, 9, 27))) + s("B", 6, "Current")
                + s("C", 6, "Monthly transfer") + n("D", 6, "-500") + inl("F", 6, "Internal") + "</row>")
    # 7: unknown type, negative -> SPEND; sparse columns; same category again with group now filled
    rows.append('<row r="7">' + n("A", 7, serial(date(2026, 9, 28))) + s("C", 7, "Cafe & Bakery")
                + n("D", 7, "-4.2") + s("E", 7, "Groceries") + inl("F", 7, "weird") + s("G", 7, "Food")
                + '<c r="J7" t="b"><v>1</v></c>' + "</row>")
    # 8: unknown type, positive -> INCOME
    rows.append('<row r="8">' + n("A", 8, serial(date(2026, 9, 29))) + inl("C", 8, "Refund")
                + n("D", 8, "10") + "</row>")
    sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             '<cols><col min="1" max="1" width="12"/></cols><sheetData>' + "".join(rows)
             + "</sheetData></worksheet>")
    sheet2 = ('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
              '<row r="2"><c r="B2"><v>7</v></c></row></sheetData></worksheet>')
    workbook = ('<?xml version="1.0" encoding="UTF-8"?><workbook '
                'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
                '<sheet name="Ledger" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/>'
                "</sheets></workbook>")
    rels = ('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="worksheet" Target="/xl/worksheets/other.xml"/>'
            '<Relationship Id="rId3" Type="sharedStrings" Target="sharedStrings.xml"/></Relationships>')
    sst_xml = ('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + sst + "</sst>")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("xl/workbook.xml", workbook, compress_type=zipfile.ZIP_STORED)
        z.writestr("xl/_rels/workbook.xml.rels", rels)
        z.writestr("xl/sharedStrings.xml", sst_xml)
        z.writestr("xl/worksheets/sheet1.xml", sheet)
        z.writestr("xl/worksheets/other.xml", sheet2)


HDF_HEADER = "MPRN,Meter Serial Number,Read Value,Read Type,Read Date and End Time\n"
MPRN, SERIAL_NO = "10000000000", "000000000"
REG_TYPES = {"night": "Night Active Import Register (kWh)", "day": "Day Active Import Register (kWh)",
             "peak": "Peak Active Import Register (kWh)"}
BASE = {"night": 1000.0, "day": 2000.0, "peak": 300.0}
USE = {"night": 4.125, "day": 6.5, "peak": 1.25}


def cumulative(stamps):
    """stamps ascending -> {reg: {stamp: reading}} with slightly varying daily use."""
    out = {r: {} for r in REG_TYPES}
    for r in REG_TYPES:
        v = BASE[r]
        for i, d in enumerate(stamps):
            if i:
                v += USE[r] + 0.1 * i
            out[r][d] = round(v, 3)
    return out


def hdf(stamps, fmt):
    """Newest first, registers interleaved, plus interval rows that must be skipped."""
    cum = cumulative(stamps)
    lines = [HDF_HEADER]
    for d in sorted(stamps, reverse=True):
        lines.append(f"{MPRN},{SERIAL_NO},0.512,Active Import Interval (kW),{d:%d-%m-%Y} 00:30\n")
        for r, t in REG_TYPES.items():
            lines.append(f"{MPRN},{SERIAL_NO},{cum[r][d]},{t},{fmt(d)}\n")
    return "".join(lines), cum


def native(d):
    return f"{d:%d-%m-%Y} 00:00"


def mangled(d):
    """What a US-locale Excel round trip leaves behind."""
    if d.day > 12:
        return native(d)                      # could not be parsed: stays dd-mm-yyyy text
    swapped = date(d.year, d.day, d.month)    # Excel read dd-mm as mm-dd
    if d.day % 3 == 1:
        return str(serial(swapped))           # stored as a serial of the wrong date
    if d.day % 3 == 2:
        return str(serial(d))                 # correct serial (day/month swap also plausible)
    return f"{d.month}/{d.day}/{d.year} 0:00"  # m/d/yyyy text of the true date


def expected_daily(stamps, cum):
    rows = []
    for prev, cur in zip(stamps, stamps[1:]):
        row = {"date": (cur - timedelta(days=1)).isoformat()}
        for r in REG_TYPES:
            row[r] = round(cum[r][cur] - cum[r][prev], 3)
        row["total"] = round(sum(row[r] for r in REG_TYPES), 3)
        rows.append(row)
    return rows


@unittest.skipUnless(shutil.which("node"), "node not installed")
class MoneyImportTest(unittest.TestCase):
    def run_node(self, mode, mod, name, data):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / "run.js").write_text(HARNESS)
            inp = tmp / name
            if isinstance(data, str):
                inp.write_text(data)
            else:
                data(inp)
            p = subprocess.run(["node", str(tmp / "run.js"), mode, str(mod), str(inp)],
                               capture_output=True, text=True, timeout=60)
            self.assertEqual(p.returncode, 0, p.stderr)
            return json.loads(p.stdout)

    # ---------- xlsx ----------
    def test_xlsx_sheets_and_ledger(self):
        out = self.run_node("xlsx", XLSX_JS, "book.xlsx", make_xlsx)
        self.assertEqual(out["global"], "function")
        self.assertEqual(out["dates"], ["1900-01-01", "1900-02-28", "1900-02-29", "1900-03-01",
                                        "2023-03-15", "2025-09-30"])
        sheets = out["sheets"]
        self.assertEqual(list(sheets), ["Ledger", "Notes"])
        self.assertEqual(sheets["Notes"], [[], [None, 7]])
        led = sheets["Ledger"]
        self.assertEqual(led[0][7], "Essential/Flexible")
        self.assertEqual(led[1][0], serial(date(2026, 9, 1)))      # dates stay serials
        self.assertEqual(led[3], [])                                # empty row kept in place
        self.assertEqual(led[5][2], "Monthly transfer")             # rich text runs joined
        self.assertEqual(led[6][2], "Cafe & Bakery")                # entity decoded
        self.assertEqual(led[6][1], None)                           # sparse column position kept
        self.assertIs(led[6][9], True)                              # boolean cell
        self.assertEqual(led[4][8], "auto <monthly>")               # inline string

        res = out["ledger"]
        tx = res["txns"]
        self.assertEqual(len(tx), 6)
        self.assertEqual([t["date"] for t in tx],
                         ["2026-09-01", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"])
        self.assertEqual([t["kind"] for t in tx], ["SPEND", "INCOME", "SAVE", "INTERNAL", "SPEND", "INCOME"])
        self.assertEqual([t["amount"] for t in tx], [-42.5, 3100, -200, -500, -4.2, 10])
        self.assertEqual([t["essential"] for t in tx], [True, None, False, None, None, None])
        self.assertEqual(tx[0], {"date": "2026-09-01", "account": "Current", "desc": "Grocery Shop",
                                 "amount": -42.5, "category": "Groceries", "kind": "SPEND",
                                 "group": "Food", "essential": True, "note": ""})
        self.assertEqual(tx[2]["note"], "auto <monthly>")
        self.assertEqual(res["categories"], [
            {"name": "Groceries", "group": "Food", "essential": True},
            {"name": "Salary", "group": "", "essential": None},
            {"name": "Savings", "group": "", "essential": False},
        ])

    # ---------- ESB HDF ----------
    def test_hdf_native_dates(self):
        stamps = [date(2025, 10, 1) + timedelta(days=i) for i in range(5)]  # 1..5 Oct stamps
        text, cum = hdf(stamps, native)
        out = self.run_node("esb", ESB_JS, "hdf.csv", text)
        self.assertEqual(out["registers"], ["night", "day", "peak"])
        self.assertEqual(out["skipped"], 5)
        self.assertEqual(len(out["reads"]), 15)
        self.assertEqual(out["reads"][0], {"date": "2025-10-01", "register": "night", "value": 1000})
        self.assertEqual(out["daily"], expected_daily(stamps, cum))
        # first delta ends at the 02-10 00:00 read, which closes 1 Oct
        self.assertEqual(out["daily"][0]["date"], "2025-10-01")
        self.assertEqual(out["daily"][0]["night"], 4.225)
        self.assertNotIn("MPRN", json.dumps(out))
        self.assertNotIn(MPRN, json.dumps(out))

    def test_hdf_excel_mangled_across_month(self):
        stamps = [date(2025, 9, 27) + timedelta(days=i) for i in range(11)]  # 27 Sep .. 7 Oct
        text, cum = hdf(stamps, mangled)
        # the fixture really is mangled: serials of the wrong date and m/d/yyyy text both present
        self.assertIn(str(serial(date(2025, 1, 10))), text)   # 1 Oct as Jan 10 serial
        self.assertIn(",10/3/2025 0:00", text)               # 3 Oct as m/d text
        self.assertIn(str(serial(date(2025, 10, 2))), text)   # 2 Oct correct serial
        self.assertIn("30-09-2025 00:00", text)
        out = self.run_node("esb", ESB_JS, "hdf.csv", text)
        self.assertEqual(out["skipped"], 11)
        self.assertEqual(sorted({r["date"] for r in out["reads"]}), [d.isoformat() for d in stamps])
        self.assertEqual(out["daily"], expected_daily(stamps, cum))
        self.assertEqual([d["date"] for d in out["daily"]][2:6],
                         ["2025-09-29", "2025-09-30", "2025-10-01", "2025-10-02"])

    def test_hdf_24h_gap_and_broken_delta(self):
        t = "24 Hr Active Import Register (kWh)"
        text = HDF_HEADER + "".join(f"{MPRN},{SERIAL_NO},{v},{t},{s}\n" for v, s in [
            (520.0, "08-10-2025 00:00"),   # after a gap: no delta
            (510.0, "06-10-2025 00:00"),
            (400.0, "05-10-2025 00:00"),   # 5->6 Oct: 110 kWh ok
            (900.0, "04-10-2025 00:00"),   # 4->5 Oct negative: skipped
            (890.5, "03-10-2025 00:00"),
        ]) + f"{MPRN},{SERIAL_NO},,{t},02-10-2025 00:00\n"   # blank value: skipped
        out = self.run_node("esb", ESB_JS, "hdf.csv", text)
        self.assertEqual(out["registers"], ["24h"])
        self.assertEqual(out["skipped"], 1)
        self.assertEqual(out["daily"], [
            {"date": "2025-10-03", "24h": 9.5, "total": 9.5},
            {"date": "2025-10-05", "24h": 110, "total": 110},
        ])


if __name__ == "__main__":
    unittest.main()
