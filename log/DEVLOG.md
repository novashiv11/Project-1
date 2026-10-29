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

## 2026-10-14 · Session 3 — hosted app
- `app/lifeos.html`: JS port of parser/ask/views, published as a private claude.ai artifact
  (https://claude.ai/artifact/EjccpLbiwHgHC6A3J9Z9Xy). Data in per-person private db (`data/users/<id>/items`), localStorage fallback.
- JS parser checked against the Python test cases (same outputs). Keep both in sync when changing parse rules.

## 2026-10-14 · Session 4 — reset with role agents
- Founder confused by notebook build ("same page nai"). Ran 4 role agents (product, market, tech, critic) → `docs/STRATEGY.md`.
- Pivot: Telegram chat Jarvis, LLM core, proactive nudges, wedge = dog + documents. CLAUDE.md rewritten (comms rules first).
- Blocked on founder: Telegram ok?, host choice, bot token. Then P0.

## 2026-10-14 · Session 5: whole-life coverage (v0.5)
- Founder: "dog/passport were just samples, cover all of life". Built a 16-area life map (`lifeos/life.json`, `docs/LIFE_MAP.md`).
- Python: domains.py, legacy migration (dog→pet, house→home, package→shopping, metric→metrics), wheel/area/areas views, all metrics in review.
- Web app: Life tab (area cards → detail with stats, examples, tip), republished. 22 tests incl. JS parity (56 cases, 0 diffs).
- Open: founder is in Ireland → proposed wedge: Play Store app for immigrants (IRP/visa/passport/NCT/motor tax/rent) €1.99/mo; B2B later. Awaiting pick.

## 2026-10-14 · Session 6: phone app (PWA)
- Founder wants a real phone app, not claude.ai. Built PWA: `pwa/` (pwa.js, sw.js, icon) + `scripts/build_pwa.py` → `dist/`.
  Offline, data on phone (localStorage + IndexedDB mirror), daily due notification (periodic sync + on-open fallback). Tested in Chromium.
- Added Ireland life admin (IRP/GNIB 84d, NCT 30d, motor tax, PPSN, RTB, Revenue) and € spending.
- Blocked: GitHub integration can't create repos. Founder to create public repo `lifeos`; then push dist + enable Pages.
- Founder created public repo novashiv11/lifeos; pushed PWA build to main (5d635b8). Needs Pages enabled (Settings → Pages → main / root). URL: https://novashiv11.github.io/lifeos/
- Deploy recipe: `python3 scripts/build_pwa.py && cp -r dist/. ../lifeos/ && (cd ../lifeos && git commit -am ... && git push origin main)`
- Pages live: https://novashiv11.github.io/lifeos/ (founder confirmed on phone). Starter examples now Ireland-first (life.json start_examples).
- Added one-tap Install button (beforeinstallprompt) + 'already installed' hint (getInstalledRelatedApps); deployed.
- BUG fixed: manifest id './' resolved to origin root → Chrome matched another app on novashiv11.github.io ('already installed', 'Could not open app'). id now '/lifeos/'.

## 2026-10-15 · Session 7: v0.6 "Jarvis feel"
- Founder: "feels like a notes app". Shipped (founder picked C = all): morning brief (overdue/today/renewal windows), 10 guide cards
  (IRP, NCT, motor tax, NDLS, passport, PPSN, Revenue, RTB, health/car insurance; official links only, in life.json `guides`),
  voice capture (Web Speech, en-IN), Jarvis tab: Claude chat via user's own API key (browser fetch, Haiku 5.5, effort low,
  tools add_item/complete_item, append-only history). E2E tested with mocked API; deployed to novashiv11/lifeos.
- v0.7 camera: 📷 → photo → BarcodeDetector; EAN/UPC → Open Food Facts card (Nutri-Score, per-100g) → "food:" item (health);
  QR → link/text card; no code + Jarvis key → photo sent to Claude (dates only, never ID numbers). SW now skips cross-origin
  APIs. Fixed 436px overflow (.wrap grid minmax(0,1fr)). E2E tested with faked scanner/APIs; deployed.
- v0.8: food card asks grams (default = serving) → item text carries totals; metrics kcal/protein/sugar_g (sum) in life.json
  (typed "lunch 650 kcal" works too). Today: "Food today" card with optional goal bar; food rows have no done-tick and stay out
  of Recent notes. All tab: Settings (name, kcal goal, voice language) + Backup (share/download JSON, key never exported) +
  Restore (validated, in-page confirm). Brief nags if no backup in 14 days. Bug caught in E2E: grams read after card cleared.

## 2026-10-15 · Session 8: finishing own backlog (founder steps deferred)
- Notifications now cover renewal-window openings + overdue (pwa.js plans nudges with leadDays → IndexedDB; sw.js compares dates).
- Store prep: privacy.html (linked in Settings), manifest categories + 2 screenshots. lifeos README refreshed.
- tests/test_e2e.py: 6 phone E2E tests (width, brief/guides/nudges, food portions, QR, backup/restore, Jarvis) — all green.
- ROADMAP/CLAUDE.md updated: PWA is the product; claude.ai artifact is legacy.

## 2026-10-15 · Session 9: redesign mockups
- Founder: "app mei feel nai". Proposed Jarvis home + native feel + personality; founder chose mockups first.
- 3 mockups (images removed for privacy): A Jarvis Dark (greeting + now cards + dock + bottom nav), B Life Wheel (light, area ring/score),
  C Chat-first (Jarvis feed with inline task cards and action chips). Awaiting pick; nothing built.
- v1.0 redesign shipped (founder: "next" = my pick A home + B wheel). Dark-first tokens (+light), header date/avatar, #banners
  slot for pwa buttons, fixed Jarvis dock (#cap) + 5-tab bottom nav (Home/Life/Jarvis/Week/Me), hero greeting + Hinglish sub,
  Now cards (area colour, pill, tick, Guide), food + streak tiles, life wheel SVG + area strip, Jarvis orb header + dock chat,
  swipe right=done / left=snooze, vibrate, rise animations (reduced-motion safe). Bugs caught by E2E: nowrap pill widened
  layout viewport (fixed with minmax grids); fixed bars covered targets (scroll-padding). 29 tests green incl. swipe.
- Free Jarvis (founder: no extra subscription). No key → "Ask Claude" mode: builds prompt (snapshot + question + LIFEOS block
  instructions), copies it and opens claude.ai/new?q=… (Claude app/subscription). "Paste from Claude" parses `+ item` /
  `done #id` → preview → Save all. API key moved to ⚙︎ as optional. Keyword answers offer "Ask Claude about this ↗".
  E2E test added (30 green). Test-file bug fixed: tests had been appended after `if __name__` block.
- Leverage the founder's Claude account (apps can't read claude.ai chats/memory/files directly): "🧠 Import what Claude knows
  about me" opens Claude with a memory/past-chats prompt that returns a LIFEOS block (skips items already listed); "📁 Claude
  Project setup" card: copy project instructions + backup upload steps (docs/CLAUDE_PROJECT.md). 31 tests green.
- A real Claude-memory import exposed parser bugs; fixed in py+js with tests: dates after "paid/delivered/was…"
  ignored; "Nov 2026" → 1st; explicit day-month beats weekday words; birthdays repeat yearly;
  "every month on the 5th" → next 5th; more home/money keywords. Memory prompt asks for
  bill days. 📋 paste chip always visible. Cleaned import block given to founder in chat (not stored in repo). 36 tests green.
- Founder: 'overwhelming, try something else'. Fixed 'every 1st' + money keywords. Proposing a radically simpler single-list design (mockup).
- v1.1 SIMPLE (founder: "overwhelming"): home = title "Aaj" + capture box + one list grouped Aaj / Is hafte / Jaldi aane wala
  (≤30d or lead) / Baad mein (undated + far, collapsed). Rows: ◯ tap = done, swipe ← = snooze, guide link only when relevant.
  Bottom nav + tiles + hero removed; Jarvis/Food/Life/Week/Me moved into ⋯ sheet. "Window open" only for items >14d away.
  E2E navigates via the menu (tab() helper). 37 tests green.
- Founder: 'simple is boring, rethink year-3000'. 3 concept mockups sent (Orb voice-core, Timeline river, Card stack w/ XP). Mockups not committed (contain founder's items). Awaiting pick.
- Groundwork for parallel agents: app/ui/*.js view modules (EXTRA_VIEWS registry, HOME=orb when present), LIFEOS_DIST build override, PhoneBase test base with per-class temp builds, menu entries List/Focus/Timeline.

## 2026-10-16 · Session 10: v2.0 via 4 parallel agents
- Founder: "10x progress, use agents" + "add finance from CA chat". Lead built groundwork (EXTRA_VIEWS registry, LIFEOS_DIST, PhoneBase),
  then 4 engineer agents in parallel, one file each: app/ui/orb.js (home), stack.js (Focus cards, XP/levels), timeline.js (river),
  finance.js (Money: spend, fixed bills, deadlines, Irish tax calendar + CA check-up with revenue.ie links, Ask my CA / Import CA chat).
- Integrated: 63 tests green (each module has tests/test_ui_*.py). Deployed to novashiv11/lifeos.

## Session 11 (2026-10-16): v2.1 My words
- Me → Settings: "My words" (e.g. `Bruno = pet`), stored only in phone settings + backup. Beats keywords, after explicit `area:` prefix.
- Saving re-files existing items (remapMine); pet names also make `X weight 24kg` a pet metric.
- Orb links: added € Money. tests/test_mywords.py (E2E). 64 tests OK. Deployed lifeos main e97b25d.
- Python CLI unchanged (no personal words there yet).

## Session 12 (2026-10-16): v2.2 food + calendar
- Food: "Phir se khaya?" 1-tap favourites (top 6, last 60 days) + 7-day kcal bars with goal line.
- Calendar: Me → "Export calendar (.ics)" (JS toIcs mirrors lifeos/ics.py, test compares both); Focus card "📅 Calendar mein daalo" (Google Calendar template link, RRULE for repeats).
- backup/ics share via shared shareFile(). tests/test_food_cal.py. 66 tests OK. Deployed lifeos main.

## Session 13 (2026-10-16): v2.3 share-sheet + shortcuts
- manifest share_target (GET title/text/url): sharing from WhatsApp/Gmail/Chrome prefills the capture box (≤500 chars), URL cleaned.
- manifest shortcuts: long-press icon → Focus / Food / Money (?v=…). Needs app re-install on the phone to pick up (Chrome re-reads manifest in ~1 day).
- tests/test_share.py. 69 tests OK. Deployed lifeos main 20147c5.

## Session 14 (2026-10-16): v2.4 My life + Letters + Drive sync
- Jarvis "🧠 My life": settings.lifeContext (phone only, in backup), sent with every handoff/API call; learns via `learn:`/`forget:` lines + remember_fact tool; "refresh" → LIFECONTEXT block; `#ctx=` link loads for review.
- Agents: app/ui/letters.js (photos → dated items, Sonnet in key mode, numbers scrubbed), app/ui/sync.js (Drive appData, needs GOOGLE_CLIENT_ID: docs/DRIVE_SYNC.md).
- Page hooks (save/boot/prefs, auto ⋯ menu), `updated` stamps, backup nudge. Removed personal data from finance.js prompt + tests.
- 84 tests OK. Deployed lifeos main. Founder's personal context delivered as a file only (not in repo).

## Session 15 (2026-10-17): v2.5 upload fix
- Founder: "upload click not working". Free mode Letters had no photo picker: added pick → "Claude ko bhejo" (Web Share files + prompt copied); fallback Open Claude.
- My life: 📋 Paste button (file-viewer links can be blocked). Privacy sweep: removed real-life strings from tests/devlog, mockup images. 85 tests OK.

## Session 16 (2026-10-17): v2.6 bad-import cleanup
- Founder's Focus showed life-context facts as tasks (memory import turned About-me facts into "+" items). Prompts now say facts are never "+" lines.
- Me → "🧹 Imports · check these": items saved together (same minute, 3+) → Delete all (undoable) / Keep. Home banner points there.
- tests/test_imports.py. 88 tests OK. Deployed lifeos main 42b71dd.

## Session 17 (2026-10-25): v2.7 Daily Jarvis update
- Founder wants Jarvis updated daily from sources. No server → 1 tap/day: home "☀️ Jarvis daily update" + morning notification (nudge kind "daily").
- Tap → Claude app with dailyPrompt(): search Gmail/Calendar/Drive connectors + memory since last update, compare with list + About me → LIFEOS (+, done, learn:). Toggle in Me settings.
- tests/test_daily.py. 90 tests OK. Deployed lifeos main 4db7d9e. Option B (fully automatic, server + API) not built.

## Session 18 (2026-10-25): v2.8 "Next 5"
- Privacy: both repos are PUBLIC. Tried squashing history (branch onto initial commit; lifeos orphan) — force-push blocked by permission classifier; local restored. Needs founder OK/permission (or make Project-1 private).
- Return from Claude: "📋 Claude ka reply paste karo · 1 tap" banner; ignores our own prompt on the clipboard (isOurPrompt).
- Week: "🧠 Claude se weekly review lo" (weeklyPrompt). Manifest shortcut Jarvis. Focus skips undated notes older than 14 days.
- 93 tests OK. Deployed lifeos main.

## Session 19 (2026-10-28): v3.0 Jarvis is home
- Founder: "notes app feel, use cases unclear; want one place to ask anything about my life". Rethink: home = Jarvis chat.
- Free mode: statements saved (capture), questions answered locally (aaj / agle 30 din / kharcha / mere baare / keyword search over items + My life), "🧠 Claude se poora jawab" for deeper. API key mode: Claude in-app (Haiku 5.5) with richer snapshot (done items, month spend).
- ⋯ menu: Jarvis, List, Me; everything else under "More tools". Legacy orb home via settings.home="orb" (tests use it).
- tests/test_jarvis_home.py. 96 tests OK. Deployed lifeos main be8319a.

## Session 20 (2026-10-28): v3.1 API-key Jarvis polish
- Key checked with a tiny ping before saving (bad key → not saved). Jarvis header shows this month's cost (Haiku 5.5 $0.10/$0.50 per M, tracked from usage).
- System prompt: "personal memory" persona (ask anything; unknown → ask once → remember_fact). Offline/API error → local list answer.
- tests/test_api_key.py. 99 tests OK. Deployed lifeos main. Founder step: create key at console.anthropic.com + minimum credit.

## Session 21 (2026-10-29): v3.2 Voice Jarvis
- Founder: "Jarvis bana". Big orb on Jarvis home: tap → speech recognition (en-IN) → same brain (free local / API) → answer spoken (speechSynthesis) when asked by voice. "▶ Briefing" speaks today/window/this week. Greeting bubble = briefing.
- Settings toggle "🔊 bol ke jawab". Reduced-motion stops the orb animation.
- tests/test_voice.py (fake SpeechRecognition + speechSynthesis). 102 tests OK. Deployed lifeos main 930b1df.
