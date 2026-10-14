# Roadmap

## Done
- v0.1 (2026-10-14) — CLI capture, auto-domain, dates, tracking numbers; today/list/search/done
- v0.2 (2026-10-14) — documents surface 90d ahead; recurring items roll forward on `done`;
  metrics (dog/my weight, mood) parsed from text; `life dog` dashboard; `life review` weekly + journal prompt;
  `domain:` prefix override; `pip install -e .` gives a `life` command

- v0.3 (2026-10-14) — questions (`life ...?` or `life ask`) via keyword+synonym match; `life export ics`
  (RRULE for repeats, 30-day alarm on documents); `edit` + `undo` ops; Hinglish dates (aaj/kal/parso/agle hafte/N din baad/somvar…)

- v0.4a (2026-10-14) — `life serve`: one-box mobile web UI over the CLI, ✔ buttons, dark mode, token auth when exposed

## Now (P0: Telegram Jarvis, see STRATEGY.md) needs: bot token, host choice
- [ ] `lifeos/telegram.py`: long-polling bot, allowlisted chat_id, every message → existing pipeline
- [ ] Nudge loop (15 min) + 08:45 IST brief only if something due; [Done][Snooze][Kal] buttons
- [ ] Read back parsed dates for confirmation; 7-day validation log (captures/day, nudges acted on)

## Next (P1: real chat) needs: Anthropic API key
- [ ] `lifeos/brain.py`: Claude tool use (add/query/update/complete/set_reminder/log_metric/get_view), Haiku, cached prompt
- [ ] Fast path: parser handles confident captures + commands at 0 tokens; LLM gets parser hint
- [ ] SQLite store + JSONL importer; usage table with $3/mo cap → parser-only fallback

## Later (P2)
- [ ] Voice capture; phone share-sheet
- [ ] Two-way Google Calendar sync
- [ ] Package tracking via carrier APIs
- [ ] Web/mobile UI; encrypted sync
- [ ] Move to dedicated repo (`lifeos`) once v0.2 is stable
