# Roadmap

## Done
- v0.1 (2026-10-14) — CLI capture, auto-domain, dates, tracking numbers; today/list/search/done
- v0.2 (2026-10-14) — documents surface 90d ahead; recurring items roll forward on `done`;
  metrics (dog/my weight, mood) parsed from text; `life dog` dashboard; `life review` weekly + journal prompt;
  `domain:` prefix override; `pip install -e .` gives a `life` command

- v0.3 (2026-10-14) — questions (`life ...?` or `life ask`) via keyword+synonym match; `life export ics`
  (RRULE for repeats, 30-day alarm on documents); `edit` + `undo` ops; Hinglish dates (aaj/kal/parso/agle hafte/N din baad/somvar…)

- v0.4a (2026-10-14) — `life serve`: one-box mobile web UI over the CLI, ✔ buttons, dark mode, token auth when exposed

## Now (v0.4b — always-on Jarvis) — needs owner input
- [ ] LLM fallback for classify/ask when `ANTHROPIC_API_KEY` is set (regex path stays default)
- [ ] Telegram bot capture (needs bot token from user) — chat from anywhere, not just home Wi-Fi
- [ ] Daily morning nudge message (today view) via Telegram
- [ ] Hosting: small always-on box (Raspberry Pi / cheap VPS) so phone access works outside home

## Later (v0.5+ — Jarvis)
- [ ] Voice capture; phone share-sheet
- [ ] Two-way Google Calendar sync
- [ ] Package tracking via carrier APIs
- [ ] Web/mobile UI; encrypted sync
- [ ] Move to dedicated repo (`lifeos`) once v0.2 is stable
