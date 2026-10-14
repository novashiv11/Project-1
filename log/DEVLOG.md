# Dev Log (append one entry per session, newest at bottom)

## 2026-10-14 · Session 1 — kickoff
- Concept: LifeOS/Jarvis — life journal + assistant for owner & dog (calendar, house, packages, documents, ideas).
- Set up product org: CLAUDE.md (self-prompt), VISION, ROADMAP, DECISIONS, this log, role agents.
- Shipped v0.1 CLI: capture → domain/date/tracking parse → JSONL; `today`, `list`, `search`, `done`. Tests green.
- Next: v0.2 expiry nudges + recurring items.

## 2026-10-14 · Session 2 — v0.2 smart nudges
- Shipped: 90-day document lead time, recurring items (`every N days/weeks`, `monthly`, `every monday`), metrics (weight/mood),
  `life dog`, `life review`, prefix override, command-vs-note disambiguation, pyproject `life` script. 10 tests green.
- Split views into `lifeos/views.py`; CLI passes `today` into parse so tests are date-independent (except review test, uses real today).
- Next: v0.3 — `ask`, ICS export, edit/undo, Hinglish dates.

## 2026-10-14 · Session 2b — v0.3 ask & export
- Shipped: `ask` / `?` questions (`lifeos/ask.py`), ICS export (`lifeos/ics.py`), edit/undo ops, Hinglish dates. 15 tests green.
- Next: v0.4 `life serve` local web app for phone capture.

## 2026-10-14 · Session 2c — v0.4a web UI
- Shipped `lifeos/web.py` + `life serve` (stdlib only). Tested: capture, ask, done buttons, HTML escaping, token 403s. 17 tests green.
- Verified 390px phone layout via Playwright (no horizontal scroll).
- Blocked on owner: Telegram bot token, Anthropic API key, hosting choice.
