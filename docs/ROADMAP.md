# Roadmap

## Done
- v0.1 (2026-10-14) — CLI capture, auto-domain, dates, tracking numbers; today/list/search/done
- v0.2 (2026-10-14) — documents surface 90d ahead; recurring items roll forward on `done`;
  metrics (dog/my weight, mood) parsed from text; `life dog` dashboard; `life review` weekly + journal prompt;
  `domain:` prefix override; `pip install -e .` gives a `life` command

## Now (v0.3 — ask & export)
- [ ] `life ask "when is the dog's next vaccine?"` — keyword answer over the store (no LLM yet)
- [ ] `life export ics` — calendar file of all dated items (import into Google/Apple Calendar)
- [ ] `life edit <id> <new text>` + `life undo` (append-only ops)
- [ ] Hinglish date words: kal (tomorrow), parso, agle hafte

## Later (v0.4+ — Jarvis)
- [ ] LLM parsing fallback (Claude API) for ambiguous input; keep regex path for offline
- [ ] Chat interface: "when is the dog's next vaccine?" answered from the store
- [ ] Input channels: Telegram bot → phone share-sheet → voice
- [ ] Calendar sync (ICS export first, then Google Calendar)
- [ ] Package tracking via carrier APIs
- [ ] Web/mobile UI; encrypted sync
- [ ] Move to dedicated repo (`lifeos`) once v0.2 is stable
