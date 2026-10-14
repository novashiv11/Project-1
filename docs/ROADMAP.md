# Roadmap

## Now (v0.1 — capture core) ✅ shipped 2026-10-14
- [x] CLI capture, auto-domain, date parsing, tracking-number detection
- [x] `today` view (overdue + next 7 days), list/search/done

## Next (v0.2 — smart nudges)
- [ ] Expiry rules: documents → remind 90/30/7 days before (passport, visa, insurance)
- [ ] Recurring items: "every month rent", "dog flea meds every 30 days"
- [ ] Dog profile: weight log, vaccine schedule
- [ ] `review` command: weekly summary + journal prompt

## Later (v0.3+ — Jarvis)
- [ ] LLM parsing fallback (Claude API) for ambiguous input; keep regex path for offline
- [ ] Chat interface: "when is the dog's next vaccine?" answered from the store
- [ ] Input channels: Telegram bot → phone share-sheet → voice
- [ ] Calendar sync (ICS export first, then Google Calendar)
- [ ] Package tracking via carrier APIs
- [ ] Web/mobile UI; encrypted sync
- [ ] Move to dedicated repo (`lifeos`) once v0.2 is stable
