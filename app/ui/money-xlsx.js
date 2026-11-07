/* MoneyXLSX: dependency-free .xlsx reader for the Money module (browser + node 22).
   readSheets(bytes) -> { sheetName: rows } ; rows = arrays of cell values (string|number|boolean|null),
   row and column positions preserved from the cell "r" refs ("C5" -> rows[4][2]). Dates stay Excel serials.
   excelDate(serial) -> "YYYY-MM-DD" (1900 system, keeps Lotus bug: 60 = "1900-02-29").
   ledgerToTxns(rows) -> { txns, categories } for a "Ledger" sheet with a header row.
   ZIP: central directory, methods 0 (stored) and 8 (deflate via DecompressionStream("deflate-raw")).
   XML: small regexes (no DOMParser in node); tags may carry a namespace prefix (x:c). */
(function (root) {
  "use strict";
  const NS = "(?:[A-Za-z_][\\w.-]*:)?"; // optional namespace prefix

  /* ---------- bytes / zip ---------- */
  function toU8(buf) {
    if (buf instanceof Uint8Array) return buf;
    if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
    if (ArrayBuffer.isView(buf)) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    throw new TypeError("MoneyXLSX: expected ArrayBuffer or Uint8Array");
  }

  async function inflateRaw(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Returns { name: async () => Uint8Array } from the central directory.
  function zipEntries(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("MoneyXLSX: not a zip/xlsx file");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder("utf-8");
    const out = {};
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("MoneyXLSX: bad central directory");
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      out[name] = async () => {
        if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error("MoneyXLSX: bad local header " + name);
        const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
        const data = u8.subarray(start, start + csize);
        if (method === 0) return data;
        if (method === 8) return inflateRaw(data);
        throw new Error("MoneyXLSX: unsupported zip method " + method);
      };
    }
    return out;
  }

  /* ---------- xml helpers ---------- */
  function decodeXml(s) {
    return s
      .replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (m, e) => {
        if (e === "lt") return "<"; if (e === "gt") return ">"; if (e === "amp") return "&";
        if (e === "quot") return '"'; if (e === "apos") return "'";
        const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return String.fromCodePoint(cp);
      })
      .replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16))); // OOXML escapes (_x000D_)
  }

  function attrs(s) {
    const o = {};
    const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(s || ""))) o[m[1]] = decodeXml(m[2] !== undefined ? m[2] : m[3]);
    return o;
  }

  function tagRe(tag) { // matches <tag .../> or <tag ...>body</tag>; group1 attrs, group2 body
    return new RegExp("<" + NS + tag + "\\b([^>]*?)(?:/>|>([\\s\\S]*?)</" + NS + tag + ">)", "g");
  }

  // Concatenate all <t> runs (plain <si><t> and rich text <r><t>), ignoring phonetic <rPh> runs.
  function textRuns(body) {
    if (!body) return "";
    const clean = body.replace(new RegExp("<" + NS + "rPh\\b[\\s\\S]*?</" + NS + "rPh>", "g"), "");
    let s = "", m;
    const re = tagRe("t");
    while ((m = re.exec(clean))) s += m[2] ? decodeXml(m[2]) : "";
    return s;
  }

  function colIndex(ref) {
    const m = /^([A-Za-z]+)/.exec(ref || "");
    if (!m) return -1;
    let c = 0;
    for (const ch of m[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
    return c - 1;
  }
  function rowIndex(ref) {
    const m = /(\d+)$/.exec(ref || "");
    return m ? parseInt(m[1], 10) - 1 : -1;
  }

  function parseShared(xml) {
    const out = [];
    if (!xml) return out;
    const re = tagRe("si");
    let m;
    while ((m = re.exec(xml))) out.push(textRuns(m[2]));
    return out;
  }

  function cellValue(a, body, shared) {
    const t = a.t || "n";
    if (t === "inlineStr") {
      const is = new RegExp("<" + NS + "is\\b[^>]*>([\\s\\S]*?)</" + NS + "is>").exec(body || "");
      return is ? textRuns(is[1]) : null;
    }
    const vm = new RegExp("<" + NS + "v\\b[^>]*>([\\s\\S]*?)</" + NS + "v>").exec(body || "");
    if (!vm) return null;
    const v = decodeXml(vm[1]);
    if (t === "s") { const s = shared[parseInt(v, 10)]; return s === undefined ? null : s; }
    if (t === "b") return v.trim() === "1" || v.trim().toLowerCase() === "true";
    if (t === "str" || t === "e" || t === "d") return v;
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) ? n : (v === "" ? null : v);
  }

  function parseSheet(xml, shared) {
    const rows = [];
    const rowRe = tagRe("row");
    let rm, nextRow = 0;
    while ((rm = rowRe.exec(xml))) {
      const ra = attrs(rm[1]);
      let r = ra.r ? parseInt(ra.r, 10) - 1 : nextRow;
      const row = [];
      const cellRe = tagRe("c");
      let cm, nextCol = 0;
      while ((cm = cellRe.exec(rm[2] || ""))) {
        const ca = attrs(cm[1]);
        let c = colIndex(ca.r);
        if (c < 0) c = nextCol;
        const cr = rowIndex(ca.r);
        if (cr >= 0 && !ra.r) r = cr;
        nextCol = c + 1;
        const val = cellValue(ca, cm[2], shared);
        while (row.length < c) row.push(null);
        row[c] = val;
      }
      while (rows.length < r) rows.push([]);
      rows[r] = row;
      nextRow = r + 1;
    }
    return rows;
  }

  function resolveTarget(target) {
    let p = target.startsWith("/") ? target.slice(1) : "xl/" + target;
    const parts = [];
    for (const seg of p.split("/")) {
      if (seg === "..") parts.pop(); else if (seg && seg !== ".") parts.push(seg);
    }
    return parts.join("/");
  }

  async function readSheets(buf) {
    const files = zipEntries(toU8(buf));
    const lower = {};
    for (const k of Object.keys(files)) lower[k.toLowerCase()] = files[k];
    const dec = new TextDecoder("utf-8");
    const text = async (name) => {
      const f = files[name] || lower[name.toLowerCase()];
      return f ? dec.decode(await f()) : null;
    };
    const wb = await text("xl/workbook.xml");
    if (!wb) throw new Error("MoneyXLSX: xl/workbook.xml missing");
    const rels = {};
    const relXml = await text("xl/_rels/workbook.xml.rels");
    if (relXml) {
      const re = tagRe("Relationship");
      let m;
      while ((m = re.exec(relXml))) { const a = attrs(m[1]); if (a.Id && a.Target) rels[a.Id] = resolveTarget(a.Target); }
    }
    const shared = parseShared(await text("xl/sharedStrings.xml"));
    const out = {};
    const re = tagRe("sheet");
    let m, i = 0;
    while ((m = re.exec(wb))) {
      i++;
      const a = attrs(m[1]);
      const idKey = Object.keys(a).find((k) => /(^|:)id$/.test(k));
      const path = (idKey && rels[a[idKey]]) || "xl/worksheets/sheet" + i + ".xml";
      const xml = await text(path);
      out[a.name || "Sheet" + i] = xml ? parseSheet(xml, shared) : [];
    }
    return out;
  }

  /* ---------- dates ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  function ymd(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }
  function validYMD(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1)) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  // 1900 date system. Serial 1 = 1900-01-01; Excel (after Lotus 1-2-3) pretends 1900 was a leap
  // year, so serial 60 is the fictitious 1900-02-29 and every serial >= 61 is shifted by one day.
  function excelDate(serial) {
    const n = Math.floor(Number(serial));
    if (!Number.isFinite(n) || n < 1) return null;
    if (n === 60) return "1900-02-29";
    const base = n < 60 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
    const dt = new Date(base + n * 86400000);
    return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  // Ledger date: Excel serial, "yyyy-mm-dd[...]" or day-first "dd/mm/yyyy" (also - or . separators).
  function toISODate(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return excelDate(v);
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return validYMD(+m[1], +m[2], +m[3]) ? ymd(+m[1], +m[2], +m[3]) : null;
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/.exec(s);
    if (m) {
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      return validYMD(y, +m[2], +m[1]) ? ymd(y, +m[2], +m[1]) : null;
    }
    if (/^\d+(\.\d+)?$/.test(s)) return excelDate(+s);
    return null;
  }

  /* ---------- ledger ---------- */
  const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const str = (v) => (v == null ? "" : String(v).trim());
  const COLS = {
    date: ["date"], account: ["account"], desc: ["description", "desc", "details"], amount: ["amount"],
    category: ["category"], type: ["type", "kind"], group: ["group"],
    essential: ["essentialflexible", "essentialorflexible", "essential", "flexible"], note: ["note", "notes"],
  };
  const KINDS = ["SPEND", "SAVE", "INTERNAL", "INCOME"];

  function toAmount(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    let s = str(v);
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[€£$,\s]/g, "");
    if (!/^[+-]?\d+(\.\d+)?$/.test(s) && !/^[+-]?\.\d+$/.test(s)) return null;
    const n = Number(s);
    return neg ? -n : n;
  }

  function toEssential(v) {
    if (v === true || v === false) return v;
    const s = str(v).toLowerCase();
    if (s.startsWith("essential")) return true;
    if (s.startsWith("flexible")) return false;
    return null;
  }

  // Rules: header = first row with "Date" and "Amount" cells (case-insensitive). Rows that are empty,
  // or lack a parseable date or amount, are skipped. Type -> kind (SPEND|SAVE|INTERNAL|INCOME, unknown ->
  // SPEND if amount<0 else INCOME). Money out is negative: SPEND/SAVE forced <= 0, INCOME forced >= 0,
  // INTERNAL keeps its sign. Amounts rounded to cents.
  function ledgerToTxns(rows) {
    const res = { txns: [], categories: [] };
    if (!Array.isArray(rows)) return res;
    let h = -1, col = {};
    for (let i = 0; i < rows.length && h < 0; i++) {
      const cells = (rows[i] || []).map(norm);
      if (cells.includes("date") && cells.includes("amount")) {
        h = i;
        for (const key of Object.keys(COLS)) {
          for (const name of COLS[key]) { const j = cells.indexOf(name); if (j >= 0) { col[key] = j; break; } }
        }
      }
    }
    if (h < 0) return res;
    const get = (row, key) => (col[key] === undefined ? null : row[col[key]]);
    const cats = new Map();
    for (let i = h + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      if (!row.some((v) => v !== null && v !== undefined && str(v) !== "")) continue;
      const date = toISODate(get(row, "date"));
      let amount = toAmount(get(row, "amount"));
      if (!date || amount === null) continue;
      const t = str(get(row, "type")).toUpperCase();
      const kind = KINDS.includes(t) ? t : amount < 0 ? "SPEND" : "INCOME";
      if ((kind === "SPEND" || kind === "SAVE") && amount > 0) amount = -amount;
      if (kind === "INCOME" && amount < 0) amount = -amount;
      amount = Math.round(amount * 100) / 100 || 0;
      const category = str(get(row, "category"));
      const group = str(get(row, "group"));
      const essential = toEssential(get(row, "essential"));
      res.txns.push({
        date, account: str(get(row, "account")), desc: str(get(row, "desc")), amount, category, kind,
        group, essential, note: str(get(row, "note")),
      });
      if (category) {
        const c = cats.get(category);
        if (!c) cats.set(category, { name: category, group, essential });
        else {
          if (!c.group && group) c.group = group;
          if (c.essential === null && essential !== null) c.essential = essential;
        }
      }
    }
    res.categories = [...cats.values()];
    return res;
  }

  const API = { readSheets, excelDate, ledgerToTxns, _zipEntries: zipEntries, _toISODate: toISODate };
  root.MoneyXLSX = API;
  if (typeof module !== "undefined") module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
