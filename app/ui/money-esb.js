/* MoneyESB: ESB Networks smart-meter HDF CSV -> daily kWh (browser + node 22, no deps).
   Header: MPRN,Meter Serial Number,Read Value,Read Type,Read Date and End Time.
   Only daily register rows ("Night|Day|Peak|24 Hr Active Import Register (kWh)") are used; interval rows
   and anything else are counted in `skipped`. MPRN / meter serial are never returned (privacy).

   Rules
   1. Registers are CUMULATIVE. Per register, readings are de-duplicated by date (first wins) and sorted
      ascending; daily kWh = reading(D) - reading(D-1). The first day has no delta. Deltas across a gap
      (previous reading not exactly one day earlier), negative deltas and deltas > MAX_DAILY_KWH are skipped.
   2. Consumption date = calendar date of the read stamp MINUS ONE DAY: a "02-10-2025 00:00" read closes
      1 Oct, so the delta ending at that stamp is reported as 2025-10-01. reads[].date keeps the stamp date.
   3. Dates. Native rows are "dd-mm-yyyy HH:MM" (day first). Files that went through Excel may instead hold
      an Excel serial or "m/d/yyyy H:MM" text, with day and month swapped whenever the day was <= 12.
      Each row gets candidate dates: text "a/b/yyyy" (any of / - .) -> day-first (a=day) and, when both
      parts <= 12 and differ, the swapped reading; serial -> its own date and, when day and month are both
      <= 12 and differ, the day/month swap; "yyyy-mm-dd" -> one candidate. A row with one candidate is an
      anchor. Within each register, in file order, we pick the candidate path that minimises the total
      |day jump| between consecutive rows (Viterbi over <=2 states per row). A continuous run of days
      (newest-first or oldest-first) therefore snaps every ambiguous row to the reading that sits next to
      its unambiguous neighbours. Ties keep the first candidate (day-first / the serial's own date).
   4. daily rows carry every present register (null when that register had no valid delta that day).
      total = sum of the time-of-use registers present; a "24h" register is used as total only when no
      other register has a value that day. Values rounded to 3 decimals. */
(function (root) {
  "use strict";
  const MAX_DAILY_KWH = 500;
  const DAY = 86400000;
  const ORDER = ["night", "day", "peak", "24h"];

  const r3 = (x) => Math.round(x * 1000) / 1000 || 0;
  const pad = (n) => String(n).padStart(2, "0");
  function dayNum(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const t = Date.UTC(y, m - 1, d), dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return Math.round(t / DAY);
  }
  function iso(n) {
    const dt = new Date(n * DAY);
    return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
  }

  function csvRows(text) {
    const rows = [];
    let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(f); f = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(f); f = "";
        if (row.length > 1 || row[0].trim() !== "") rows.push(row);
        row = [];
      } else f += ch;
    }
    row.push(f);
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    return rows;
  }

  function registerOf(type) {
    const s = String(type || "").trim();
    if (/interval/i.test(s)) return null;
    const m = /^(.*?)\s*active\s+import\s+register/i.exec(s);
    if (!m) return null;
    const p = m[1].trim().toLowerCase();
    if (!p) return "total";
    if (/^24/.test(p)) return "24h";
    return p.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  // Candidate stamp dates (day numbers) for one raw value; see rule 3.
  function candidates(raw) {
    const s = String(raw == null ? "" : raw).trim();
    let m;
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Math.floor(+s);
      if (n < 61) return [];
      const dt = new Date(Date.UTC(1899, 11, 30) + n * DAY);
      const y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + 1, d = dt.getUTCDate();
      const out = [dayNum(y, mo, d)];
      if (mo <= 12 && d <= 12 && mo !== d) out.push(dayNum(y, d, mo));
      return out.filter((x) => x !== null);
    }
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) {
      const n = dayNum(+m[1], +m[2], +m[3]);
      return n === null ? [] : [n];
    }
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/.exec(s))) {
      const a = +m[1], b = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      const out = [dayNum(y, b, a)];
      if (a !== b) out.push(dayNum(y, a, b));
      return out.filter((x) => x !== null);
    }
    return [];
  }

  // Viterbi: choose one candidate per row minimising sum |c[i] - c[i-1]|; ties -> lower index.
  function resolve(cands) {
    const n = cands.length;
    if (!n) return [];
    let cost = cands[0].map(() => 0);
    const back = [cands[0].map(() => -1)];
    for (let i = 1; i < n; i++) {
      const nc = [], nb = [];
      for (let k = 0; k < cands[i].length; k++) {
        let best = Infinity, bj = 0;
        for (let j = 0; j < cands[i - 1].length; j++) {
          const c = cost[j] + Math.abs(cands[i][k] - cands[i - 1][j]);
          if (c < best) { best = c; bj = j; }
        }
        nc.push(best); nb.push(bj);
      }
      cost = nc; back.push(nb);
    }
    let k = 0;
    for (let j = 1; j < cost.length; j++) if (cost[j] < cost[k]) k = j;
    const out = new Array(n);
    for (let i = n - 1; i >= 0; i--) { out[i] = cands[i][k]; k = back[i][k]; }
    return out;
  }

  function parseHDF(text) {
    const rows = csvRows(String(text || "").replace(/^﻿/, ""));
    let iVal = 2, iType = 3, iDate = 4, start = 0;
    if (rows.length) {
      const h = rows[0].map((c) => c.toLowerCase().replace(/[^a-z]/g, ""));
      if (h.includes("readvalue") || h.includes("readtype")) {
        start = 1;
        if (h.indexOf("readvalue") >= 0) iVal = h.indexOf("readvalue");
        if (h.indexOf("readtype") >= 0) iType = h.indexOf("readtype");
        const di = h.findIndex((c) => c.startsWith("readdate"));
        if (di >= 0) iDate = di;
      }
    }
    let skipped = 0;
    const byReg = new Map(); // register -> [{cands, value}] in file order
    for (let i = start; i < rows.length; i++) {
      const row = rows[i];
      const reg = registerOf(row[iType]);
      const value = Number(String(row[iVal] == null ? "" : row[iVal]).replace(/[,\s]/g, ""));
      const cands = candidates(row[iDate]);
      if (!reg || !Number.isFinite(value) || String(row[iVal] || "").trim() === "" || !cands.length) { skipped++; continue; }
      if (!byReg.has(reg)) byReg.set(reg, []);
      byReg.get(reg).push({ cands, value });
    }
    const registers = [...byReg.keys()].sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const reads = [];
    const days = new Map(); // consumption day -> {reg: kWh}
    for (const reg of registers) {
      const list = byReg.get(reg);
      const picked = resolve(list.map((x) => x.cands));
      const byDay = new Map();
      list.forEach((x, i) => { if (!byDay.has(picked[i])) byDay.set(picked[i], x.value); });
      const sorted = [...byDay.keys()].sort((a, b) => a - b);
      sorted.forEach((d, i) => {
        reads.push({ date: iso(d), register: reg, value: r3(byDay.get(d)), _d: d });
        if (i === 0 || sorted[i - 1] !== d - 1) return;
        const delta = byDay.get(d) - byDay.get(sorted[i - 1]);
        if (!(delta >= 0 && delta <= MAX_DAILY_KWH)) return;
        const cday = d - 1; // midnight read closes the previous day
        if (!days.has(cday)) days.set(cday, {});
        days.get(cday)[reg] = delta;
      });
    }
    reads.sort((a, b) => a._d - b._d || registers.indexOf(a.register) - registers.indexOf(b.register));
    reads.forEach((r) => delete r._d);
    const daily = [...days.keys()].sort((a, b) => a - b).map((d) => {
      const v = days.get(d), out = { date: iso(d) };
      let tou = 0, any = false;
      for (const reg of registers) {
        out[reg] = v[reg] === undefined ? null : r3(v[reg]);
        if (reg !== "24h" && v[reg] !== undefined) { tou += v[reg]; any = true; }
      }
      out.total = r3(any ? tou : v["24h"] || 0);
      return out;
    });
    return { registers, reads, daily, skipped };
  }

  const API = { parseHDF, _candidates: candidates, _resolve: resolve, MAX_DAILY_KWH };
  root.MoneyESB = API;
  if (typeof module !== "undefined") module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
