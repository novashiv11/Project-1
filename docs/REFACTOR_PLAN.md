# LifeOS v4 refactor plan (typed records, Cases, Today)

Status: proposal, waiting for founder "go". No code changed yet.

## Current architecture (today, v3.2)
1. Phone PWA, no server: `app/lifeos.html` (one 1,430-line file: parser, storage, views, Jarvis) plus view modules in `app/ui/*.js` (orb, stack, timeline, finance, letters, sync).
2. Build: `scripts/build_pwa.py` → `dist/` → copied to the public `novashiv11/lifeos` repo (GitHub Pages). Service worker for offline use and daily nudges.
3. Data: one flat list of free-text items in localStorage (`lifeos.items.v1`): `{id, text, domain, due, repeat, done, metrics, created, updated}`. Settings live in `lifeos.settings`: name, key, lifeContext, myWords and more.
4. Parsing is rule-based (`parse()`: dates, repeats, area by keyword from `lifeos/life.json`). It is mirrored in the Python CLI (`lifeos/`), and a parity test keeps them in step.
5. Jarvis has two modes. Free: answers from the local list, sends deeper questions to claude.ai, and takes a pasted LIFEOS block back. With an API key: browser call to the Messages API (Haiku 5.5) with tools `add_item`, `complete_item`, `remember_fact`, sending a snapshot of up to 150 items every turn.
6. Backup/restore is a JSON file. Google Drive sync is built but switched off (no OAuth client ID yet).
7. Tests: 102 (`python3 -m unittest -q`): unit, JS/Python parity, and phone E2E in headless Chromium.

## Your "broken" list, checked against the code
- 1 (everything is free text), 3 ("?" dates), 4 (disputes are one-liners), 6 (whole list in every prompt): true.
- 2 (no delete): partly true. The list has Delete and Undo, and bad imports can be deleted in bulk. Jarvis cannot delete, and the LIFEOS block has no delete op.
- 5 (hand-pasted blocks): true in free mode. API mode already saves via tools.
- 7 (preferences in Journal): the app already has My life (`lifeContext`), but older items on your phone may still hold preferences.

## Blockers and decisions
1. **Your data is only on your phone.** I can't see it from here, so the migration has to run on the phone. It shows a before → after table and only runs after you tap Approve. A backup file downloads first.
2. **Splitting mixed items** (one item holding four projects) can't be done reliably by rules. Phase 1: the migration flags them as "needs split" and you split by hand in the table. Phase 2: "Ask Claude to split" (API key, or the Claude app handoff).
3. **Home screen**: v3 made Jarvis the home. The spec wants Today. Plan: Today becomes home, quick-add + 🎙 sits on it, and Jarvis is one tap away.
4. **Reminders on Android** use the PWA notification path, and periodic background sync is best-effort. "Next action due" alerts are reliable when the app is opened daily; background alerts are not guaranteed until the Play Store (TWA) version.
5. **Privacy**: both GitHub repos are public. Test fixtures use generic names (BrandX speaker, RetailerY washer). Your real cases, profile and items are only ever created on the phone, never in the repo. The old git history still holds some personal details: make Project-1 private, or allow a history rewrite.
6. **Python CLI**: freeze it at v1 items (the parser stays shared). Typed records are phone-only for now, which avoids double work.
7. **Legal windows** (Ireland/EU): the 14-day online cancellation window comes from the delivery date. Retailer return policies need a day count you enter. Both are labelled "check your terms". The app never states a legal outcome.

## Phase 1 (weekend MVP): data model, migration, delete/archive/undo, Cases, Today

### Schema v2 (localStorage `lifeos.v2`; `lifeos.items.v1` kept untouched as a backup)
```
Record (all types)
  id, type, area, title, notes, status: open|waiting|done|archived,
  created_at, updated_at, deleted_at|null, links: [id]
  type ∈ task | recurring | deadline | case | job | project | fact | journal
  area ∈ home | money | nova(pet) | documents | shopping | family | health | projects | ideas

task       due_date|null, priority: 1-3
recurring  amount|null, every, unit(day|week|month|year), day_of_month|null, paid_each_month: bool, next_date|null
deadline   date|null, date_known: bool, remind_before_days, action_when_due
case       seller, product, order_date, delivery_date, price, bought_where, problem, want,
           timeline: [{at, channel, person, they_said, i_said, by: me|them}],
           evidence: [{kind: photo|video|email|link, ref, note}],
           next_action, next_action_date, escalation: 1..4, waiting_on: me|them
job / project / fact / journal   schema defined now, screens in Phases 2-3
Settings v2 adds  language, max_lines (5), decision_style
```
- Phase 1 never stores files: evidence is links or notes only.
- Purge rule: records with `deleted_at` older than 30 days are removed when the app opens.

### Files
- `app/ui/records.js` (new): store v2 (load/save/put), soft delete, archive, undo stack, purge, `toLegacyItems()` adapter so the old views keep working.
- `app/ui/migrate.js` (new): v1 → v2 mapping rules, the before → after review table with per-row edit/split, backup download, Approve.
- `app/ui/cases.js` (new): Cases list + case detail (timeline, add contact, escalation ladder, next action, legal-window deadlines).
- `app/ui/today.js` (new): Today home: at most 5 ranked rows, quick-add (type / 🎙), Cases strip.
- `app/lifeos.html` (edit): `HOME = today`; capture writes v2 records; ⋯ menu gets Today · Cases · Jarvis · List · Me; Me gets a Trash section (Restore / Delete now).
- `pwa/pwa.js` (edit): reminders also come from v2 deadlines and case `next_action_date`.
- `lifeos/life.json` (edit): Irish public holidays 2026-2028, used for working days.
- `tests/test_v2_*.py` (new): see below.

### Rules
- **Mapping v1 → v2**:
  - `repeat` → recurring.
  - Renew / expire / return-by / contract / cooling-off / tax / licence words → deadline.
  - Refund / dispute / small claims / CCPC / ECC / faulty / replacement words → case (the text becomes `problem`, everything else blank).
  - Other dated items → task; undated → task (no date) or journal.
  - Preference-like lines (e.g. "max N lines", "Hinglish", "prefer…") → Settings or fact.
  - "?" or "date unknown" → `date_known: false`, which puts the record in the Needs-info queue.
- **Case**:
  - Logging a contact sets `next_action_date` = +5 Irish working days and `waiting_on: them`.
  - When that date passes with no reply → a Today row "No reply from Seller · chase / escalate".
  - Escalate moves one rung up the ladder (Support → Complaints letter → ECC/CCPC → Small Claims) and sets the next action text.
  - A delivery date creates the deadline "Online cancellation window ends" (+14 days, check your terms); a return policy of N days, if entered, creates "Return window ends".
  - The case card shows days open, last contact, next action, and who is waiting on whom.
- **Today ranking**: (1) overdue deadlines and case actions, (2) due in the next 7 days, (3) one Needs-info question, (4) the active project's next step, (5) one decide-for-me suggestion. At most 5 rows; Cases strip below.

### How you test it (on the phone)
1. Open the app → banner "Upgrade to v4" → backup downloads → table of your items → fix or split rows → Approve.
2. Today shows at most 5 rows, and the Cases strip shows your disputes.
3. Open a case → "Add contact" → next action moves 5 working days ahead.
4. Delete something → Undo works; Me → Trash → Restore works.

### Tests (automatic)
- Migration mapping on a fixture of generic items: types, areas, unknown dates → Needs info, preference → settings. The v1 data is still there afterwards.
- Soft delete, undo, trash restore, 30-day purge.
- Case lifecycle: create → log contact → +5 working days (skips weekend and an Irish bank holiday) → overdue appears on Today → escalate.
- Legal-window deadlines from the delivery date.
- Today: never more than 5 rows; correct order.
- All existing 102 tests keep passing (old views read through the adapter).

## Later phases (unchanged from your spec)
- **P2**: Jarvis JSON actions + confirm cards (create/update/delete/learn, undoable), Settings in the system prompt, Needs-info queue (one question a day), LIFEOS + JSON import, relevant-context-only prompts.
- **P3**: checklists (tradesperson, purchase over €100), Recurring bills view + monthly total, "Draft next message" for cases (signed with your name from settings).
- **P4**: multi-user model, export, API/MCP connector, Play Store.
