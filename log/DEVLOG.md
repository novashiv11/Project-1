# Dev Log (append one entry per session, newest at bottom)

Older entries: `log/ARCHIVE.md`.

## Session 22 (2026-11-05): v4.0 Phase 1 — typed records, Cases, Today
- Founder wrote a full refactor spec; plan in docs/REFACTOR_PLAN.md, approved ("Next").
- app/ui/records.js: typed records layered on classic items (text/domain/due/done kept in sync both ways), store lifeos.v2 {records, trash}; v1 key kept as backup; Irish working days (bank holidays computed).
- app/ui/v4.js: reviewed migration (type/area/title per row, Split, Skip, preference lines → settings), Trash in Me (restore / delete now, 30-day purge); fresh phones start on v4.
- app/ui/cases.js (agent): case list/detail, 4-rung Irish ladder, log contact → +5 working days, legal-window deadlines from delivery date, resolve/reopen with undo.
- app/ui/today.js: Today home, max 5 ranked rows (late → 7 days → Needs-info → project → decide-for-me), Cases strip, quick-add.
- 113 tests OK. Deployed lifeos main 07df2e1. Next: Phase 2 (Jarvis JSON actions + confirm cards, settings in prompt, relevant-context only).

## Session 23 (2026-11-07): Money Phase 1
- Founder spec: Money module (local-first, encrypted). Built in the existing stack (app/ui modules, no framework).
- money-core.js (node-testable): Revolut + bank CSV parsing, ids/de-dup (n-th identical row), pending→completed, REVERTED skipped,
  SPEND/SAVE/INTERNAL/INCOME detection ("my names" setting for own-account transfers), refund netting, learning merchant rules,
  dashboard (fixed bills not extrapolated), tie-out with gap rows, what-changed, merchant frequency.
- money-xlsx.js + money-esb.js (agent): zip/xlsx reader for the tracker Ledger sheet; ESB HDF register reads with day/month-swap repair.
- money.js: encrypted IndexedDB store (AES-GCM, non-extractable device key), dashboard, stacked bars, share, trend, merchants, drill-down on every number, manual entry, export/restore.
- 131 tests OK. Deployed. Next: Phase 2 (budgets, bills, electricity charts).

## Session 24 (2026-11-08): PM review + v4.1 home feed
- Founder: "point of whole app is missing" and asked a PM (agent with his chats + life context) to answer all open questions.
- PM decisions: point = "Jarvis sorts your Irish life admin and gets you what you're owed"; home = one feed, max 5 cards (⚖️ chase → ⏳ don't forget → 💶 claim) + 📊 money one-liner; doer MVP = PRSI dental + optical only (hearing later, no LLM rewrite); panel data via allowed hosts (fallback: founder download); Money: fix parsing on real files before Phase 2; privacy: make Project-1 private, no force-push.
- Built: today.js feed per that order (claims via window.LIFEOS_CLAIMS hook for S2), money one-liner, home bar routes questions to Jarvis, ⋯ menu = Home · Money · Cases · Jarvis · Me (+ More tools).
- lifeos repo history checked: only generic broker names, no personal data → no recreate needed.
- 133 tests OK. Deployed. Next: S2 doer MVP (dental + eye).

## Session 25 (2026-11-10): review + master plan (no code)
- Founder asked for a full review and a plan for the "perfect life assistant", token-optimised.
- docs/MASTER_PLAN.md: honest review (6 home pivots, 0 real-data validation, ~1,100 legacy lines), fixed point, category map, product rules, P0–P5 with exit criteria, risks, token rules.
- ROADMAP rewritten (Now = P0 clean and prove). CLAUDE.md rewritten for the new point, map and cheaper sessions.
- DEVLOG trimmed to 3 entries (24 moved to log/ARCHIVE.md); STRATEGY/VISION/LIFE_MAP moved to docs/archive/.

## Session 26 (2026-11-11): v4.2 P0 clean-up
- Removed legacy screens and tests: orb, Focus stack, timeline, tax calendar (`finance.js`), food (incl. Open Food Facts lookup), life wheel, week review, weekly prompt. Camera now: barcode/QR → note, photo → Jarvis.
- `lifeos.html` 1,443 → 1,252 lines; 4 modules + 5 test files deleted; manifest shortcuts = Money, Cases, Jarvis; privacy page updated.
- Lesson: a range cut also removed `buzz`/`colorOf`/`AREA_COLORS` (56 test failures); found by diffing defined names old vs new. Always run that check after cutting.
- Older tests now run with the List as home (`settings.home="today"`). 103 tests OK. Deployed lifeos main f552611.
- P0 still open on the founder side: v4 upgrade + one Money import on his phone; make Project-1 private; allow gov.ie hosts.

## Session 27 (2026-11-12): v4.3 Claim (P1) + v4.4 case drafts
- P1 doer MVP: `entitle-core.js` (pure rules, renewals, draft, PPS scrub, mailto/BCC, router), `schemes.js` (PRSI dental + optical, gov.ie links), `benefits.js` (profile once, cards, provider step = Maps + official list, email draft, Mark booked → deadline for next eligibility), home claim cards, typing "dental check-up" opens the scheme (dated notes like "dentist on friday" still save).
- Scheme facts came from search extracts of gov.ie/citizensinformation.ie (hosts blocked here): re-read the pages when allowed; provider panel data still missing.
- `case-draft.js`: message per escalation step (1 support, 2 formal complaint, 3–4 summary + ECC/CCPC/Small Claims links); "I sent it" logs contact and sets +5 working days.
- Fixed: Claim form redrew on change and dropped the keyboard. 111 tests OK. Deployed.
- Founder (mid-session): "app needs to be like my second brain" → proposal sent, awaiting his pick.
