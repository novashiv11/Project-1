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
