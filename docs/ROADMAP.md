# Roadmap

## Done
- v0.1 (2026-10-14) — CLI capture, auto-domain, dates, tracking numbers; today/list/search/done
- v0.2 (2026-10-14) — documents surface 90d ahead; recurring items roll forward on `done`;
  metrics (dog/my weight, mood) parsed from text; `life dog` dashboard; `life review` weekly + journal prompt;
  `domain:` prefix override; `pip install -e .` gives a `life` command

- v0.3 (2026-10-14) — questions (`life ...?` or `life ask`) via keyword+synonym match; `life export ics`
  (RRULE for repeats, 30-day alarm on documents); `edit` + `undo` ops; Hinglish dates (aaj/kal/parso/agle hafte/N din baad/somvar…)

- v0.4a (2026-10-14) — `life serve`: one-box mobile web UI over the CLI, ✔ buttons, dark mode, token auth when exposed

- v0.5 (2026-10-14): whole-life coverage. 16 areas in `lifeos/life.json` (pets, vehicle, kids, travel, documents, family,
  work, home, money, health, mind, growth, shopping, social, ideas, calendar), per-item lead times (passport 180d, rent agreement 60d,
  insurance 30d), 9 metrics (sleep, steps, spent, water, distance, weight, mood, bp, sugar), `life wheel` / `area` / `areas`,
  web app Life tab. JS/Python parity test.

- v0.6–0.8 (2026-10-15) — phone app (PWA, novashiv11.github.io/lifeos): one-tap install, offline, notifications for due dates +
  renewal windows, morning brief, Irish admin guide cards, voice capture, camera (food barcodes via Open Food Facts, QR, photos
  to Jarvis), food portions + daily calories, Jarvis chat (own Claude key), settings, backup/restore, privacy page, E2E tests.

## Now — waiting on founder (see docs/PLAY_STORE.md)
- [ ] Founder uses the app daily for a week; collect bugs/wishes (7-day validation in STRATEGY.md)
- [ ] Play Console account → PWABuilder package → `novashiv11.github.io` repo for assetlinks → closed test (12 testers × 14 days)

## Next (Claude can do without founder)
- [ ] Sync across devices (encrypted backup to the user's Google Drive) — today data lives on one phone
- [ ] Jarvis without a personal key: small server + subscription (needed for €1.99 plan and Play Billing)
- [ ] Recurring food favourites ("same breakfast as yesterday"), weekly calorie chart
- [ ] Import from photos of IRP/insurance letters in bulk; ICS export from the phone app

## Later (P2)
- [ ] Voice capture; phone share-sheet
- [ ] Two-way Google Calendar sync
- [ ] Package tracking via carrier APIs
- [ ] Web/mobile UI; encrypted sync
- [ ] Move to dedicated repo (`lifeos`) once v0.2 is stable
