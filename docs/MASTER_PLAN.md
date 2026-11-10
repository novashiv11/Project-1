# LifeOS master plan (review + strategy), 2026-11-10

This file replaces STRATEGY.md and VISION.md as the plan of record. Details of single features stay in REFACTOR_PLAN.md and JARVIS_DOER_PLAN.md.

## 1. Honest review of what exists
**Numbers:** 24 sessions, 59 commits, about 4,200 lines of JS, 133 passing tests, 0 weeks of real daily use.

**What went wrong**
- The home screen changed six times (list → orb → Jarvis chat → voice orb → Today → feed). Each "Next" added a feature because the point of the app was never fixed first.
- Nothing has been checked against the founder's real data: not the v4 upgrade, not Money imports, not the voice orb on a real phone.
- About 1,100 lines belong to screens nobody asked to keep (orb, Focus stack, timeline, tax calendar, food, life wheel, week review). They cost tests, tokens and confusion.
- Jarvis in free mode needs copy-paste to the Claude app. That friction is why it "feels like a notes app".
- Android background notifications are best-effort in a PWA. Reminders are the core promise, so this matters.

**What is solid and stays**
- Date and Hinglish parser, reminder pipeline, typed records with Trash and undo.
- Cases (disputes with timeline, Irish escalation ladder, working-day follow-ups).
- Money core (imports, internal transfers, refunds, tie-out), encrypted on the phone.
- Local-first privacy and the test suite.

## 2. The point (fixed, do not reopen)
**"Jarvis sorts your Irish life admin and gets you what you're owed."**

One loop, and every feature must fit it:
**Capture → Understand → Find (owed / due / stuck) → Do (draft, book, pay) → Remind → Learn.**

## 3. Everything a life assistant covers, by category
Each row lists what Jarvis *does*, not what it stores. "Now" = exists, "Next" = planned, "Later" = after Play Store.

| Category | Jarvis does | State |
|---|---|---|
| Money owed | Checks entitlements (PRSI dental/eye, Med 1, tax credits, Bike to Work, SEAI), finds providers, drafts the booking or claim | Next (MVP: dental + eye) |
| Disputes | Tracks each case, chases after 5 working days, escalates, drafts the next message | Now (drafts: Next) |
| Deadlines and documents | Reminds before IRP, passport, insurance, licence dates; asks for unknown dates one at a time | Now |
| Money flow | Shows spend vs usual, month-end pace, savings rate, what changed | Now (untested on real files) |
| Bills | Detects recurring bills, flags jumps over 15%, reminds 30 days before renewals | Next |
| Home | Jobs and tradespeople with a hiring checklist; grants | Later |
| Health | Appointments, yearly benefit resets; a gentle weekly check-in with support links (not therapy) | Later |
| Pets | Vet, licence, food and medicine repeats | Now (as records) |
| People | Birthdays, calls, gifts | Now (as records) |
| Work and pay | Payslip check against the tax calculator, variable-pay view | Later |
| Projects and ideas | One active project, its next step | Now (basic) |

## 4. Product rules
1. Home is one feed, at most 5 cards, and every card has one button that does the next step.
2. Rules and data that must be right (eligibility, dates, amounts) are deterministic and offline. AI is optional and only for understanding free text.
3. Delete before adding: a new screen replaces an old one.
4. Nothing counts as done until it has run on the founder's real data on his phone.
5. Local-first. No personal data in the repo. Never store ID or account numbers.

## 5. Roadmap with exit criteria
| Phase | Work | Done when |
|---|---|---|
| P0 Clean and prove (1 session) | Remove orb, stack, timeline, food, life wheel, week review, old tax screen and their tests; archive old docs; founder runs the v4 upgrade and one Money import | Menu shows only Home, Money, Cases, Jarvis, Me; founder sends one screenshot of his real home feed |
| P1 Doer MVP (1–2 sessions) | Profile, entitlements engine, PRSI dental + eye, providers, email drafts, yearly resets | Founder books one real appointment through the app |
| P2 Money on real files (1 session) | Fix parsing on his Revolut and BOI files; recurring bills and jump alerts feed the home feed | His tie-out shows a €0 gap for one real month |
| P3 More to claim, less to type (2 sessions) | Med 1, tax credits, Bike to Work; "Draft next message" for cases; Jarvis JSON actions with confirm cards | Three entitlement cards and one case draft used for real |
| P4 Play Store (2–3 sessions + founder steps) | TWA package, first-run onboarding, reliable notifications, small server for Jarvis without a key, billing | Closed test with 12 testers running |
| P5 Later | Sync, multi-user, more counties, connectors | Paying users ask for it |

**Measure every week:** € found or saved, actions completed from the feed, days the app was opened.

## 6. Risks
- **Scheme and panel data going stale:** every scheme carries a `verified` date and an official link; nothing is written from memory.
- **Notifications:** until the TWA build, the app only reminds reliably when opened; the daily nudge covers this for now.
- **Privacy:** Project-1 is public and its old commits hold some personal details. Fix: founder makes it private.
- **Scope:** the category table is the whole map. Anything not in it waits until after P4.

## 7. Working cheaply (tokens)
- Each session reads only: CLAUDE.md → the last DEVLOG entry → the "Now" block of ROADMAP.md. Old log entries live in `log/ARCHIVE.md` and are not read.
- One roadmap item per session. Search the big file (`app/lifeos.html`) instead of reading it whole.
- Run only the tests for the files touched while working; run the full suite once before deploying.
- Agents only for work in separate files, with reports of 200 words or fewer. Screenshots only when the screen changed.
- In the app: answers come from rules first; Haiku only when a key exists; never send the full history.
