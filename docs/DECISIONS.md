# Decisions (ADR log — one line each, newest last)

- 2026-10-14 · Start in `Project-1` repo as temp home; migrate to dedicated repo after v0.2.
- 2026-10-14 · Python stdlib only, CLI-first. UI comes after the data model proves itself.
- 2026-10-14 · Storage = append-only JSONL in `$LIFEOS_HOME` (easy to diff, back up, migrate to SQLite later).
- 2026-10-14 · Rule-based parser first (offline, free, testable); LLM is a fallback, not the core.
