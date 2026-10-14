# Decisions (ADR log — one line each, newest last)

- 2026-10-14 · Start in `Project-1` repo as temp home; migrate to dedicated repo after v0.2.
- 2026-10-14 · Python stdlib only, CLI-first. UI comes after the data model proves itself.
- 2026-10-14 · Storage = append-only JSONL in `$LIFEOS_HOME` (easy to diff, back up, migrate to SQLite later).
- 2026-10-14 · Rule-based parser first (offline, free, testable); LLM is a fallback, not the core.
- 2026-10-14 · Recurring items are one item whose `due` advances (op `advance`), not N copies. Catch-up skips missed past cycles.
- 2026-10-14 · Bare commands (`today`, `dog`, `review`) only when typed alone, so "today I felt…" is captured as a note.
- 2026-10-14 · `domain:` prefix overrides auto-classification (user intent beats keywords).
- 2026-10-14 · Undo is an `undo` op cancelling the latest effective record (stack), keeping the file append-only.
- 2026-10-14 · Input ending in `?` is a question unless it has a `domain:` prefix. "kal" = tomorrow (plans > past).
- 2026-10-14 · Web UI is a thin shell over the CLI (one text box = `life <text>`), so every feature lands in both for free.
- 2026-10-14 · `serve` on a non-localhost host always requires a random token; request logs are silenced (journal text stays out of logs).
- 2026-10-14 · Hosted UI = claude.ai artifact (works on phone, no server). Python CLI stays the reference implementation.
- 2026-10-14 · **Reversed:** the LLM is the core of the chat; the rule parser is the fast path, pre-parse hint and offline fallback. (Founder wants chat.)
- 2026-10-14 · Primary channel = Telegram bot (free, proactive OK). WhatsApp deferred (Meta's Jan 2026 ban on general AI bots + template fees).
- 2026-10-14 · Wedge = dog care + document expiries. Store expiry dates only, never document numbers.
- 2026-10-14 · Process: no build without founder's "haan"; updates ≤5 lines Hinglish.
- 2026-10-14 · Founder: no Telegram. Channel = WhatsApp (focused utility, not general AI bot) or own app. Pending decision.
- 2026-10-14 · Life areas are data (`lifeos/life.json`), injected into the web app at build time; a node parity test keeps the JS parser identical.
