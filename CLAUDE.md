# LifeOS / Jarvis: self-prompt (read first, every session)

**Point (fixed):** "Jarvis sorts your Irish life admin and gets you what you're owed." Phone PWA → Play Store (€1–2/month), Ireland first. Loop: Capture → Understand → Find (owed / due / stuck) → Do (draft, book, pay) → Remind → Learn. Plan of record: `docs/MASTER_PLAN.md`.

## Talking to the founder (most important)
- Reply in **≤5 lines, Hinglish, plain words**. Details go in files, not chat.
- "Next" = build the roadmap's Now item without asking. Ask only what truly needs him, ONE question (2–3 options + a default).
- Show it on **his phone** (screenshot), not terminal output. Name blockers up front.
- He dislikes overwhelming UI: home is one feed, max 5 cards, one button per card. Delete before adding.

## Working rules (token-optimised)
1. Read only: this file → last entry of `log/DEVLOG.md` → "Now" in `docs/ROADMAP.md`. Never read `log/ARCHIVE.md` or `docs/archive/`.
2. One roadmap item per session, end to end, with tests.
3. `app/lifeos.html` is ~1,450 lines: grep it, don't read it whole.
4. While working run only the touched tests (`python3 -m unittest -q tests.test_x`); run the full suite once before deploy.
5. Agents only for work in separate files; ask for ≤200-word reports. Screenshots only when a screen changed.
6. Append ≤8 lines to `log/DEVLOG.md`; hard-to-reverse calls → one line in `docs/DECISIONS.md`.
7. Nothing is "done" until it ran on the founder's real data on his phone.
8. Privacy: both repos are public. No personal data in code, tests, docs or screenshots (generic fixtures only). Never store ID/PPS/account numbers.
9. In-app LLM: rules first; Haiku 5.5 only with a key; cache the system prompt; never send full history.
10. Plain JS + Python stdlib; no framework, no new dependency without a clear payoff.

## Map
- `app/lifeos.html`: shell, parser (mirror of `lifeos/parse.py`, guarded by `tests/test_parity.py`), Jarvis (free: `jarvisFree`/`localAnswer`; key: `askJarvis`/`callClaude`), reminders glue, hooks (`LIFEOS_HOOKS` save/boot/prefs, `EXTRA_VIEWS`, `LIFEOS_CLAIMS`)
- `app/ui/records.js` typed records (`lifeos.v2`, Trash, undo, Irish working days) · `v4.js` migration + Trash UI · `today.js` home feed (`now`)
- `app/ui/cases.js` disputes · `money-core.js` (pure, node-tested) + `money.js` (encrypted IndexedDB, UI) + `money-xlsx.js` / `money-esb.js` importers
- `app/ui/letters.js` photo → dates · `sync.js` Drive sync (off: needs client ID, `docs/DRIVE_SYNC.md`)
- Legacy, to be removed in P0: `orb.js`, `stack.js`, `timeline.js`, `finance.js`, and food / life wheel / week review inside `lifeos.html`
- `lifeos/life.json` areas, keywords, lead times, guides (run `scripts/build_app.py` after editing) · `lifeos/*.py` CLI, frozen at v1
- `pwa/` (pwa.js nudges/install, sw.js offline + periodic sync, privacy.html) · `scripts/build_pwa.py` → `dist/` → `cp -r dist/. ../lifeos/` → push `lifeos` main (GitHub Pages)
- Tests: `tests/test_e2e.py` has `PhoneBase` (headless Chromium, 390×844, APIs faked); `test_v2_*`, `test_money_*`, `test_home_feed.py`
- Plans: `docs/MASTER_PLAN.md`, `docs/JARVIS_DOER_PLAN.md`, `docs/REFACTOR_PLAN.md`, `docs/PLAY_STORE.md`

## Kickoff line the founder can paste
> "Jarvis: continue. Next 'Now' item, ask me if blocked, ship, 5-line update."
