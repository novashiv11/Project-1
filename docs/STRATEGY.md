# LifeOS / Jarvis: Strategy v2 (2026-10-14)
Synthesised from 4 role reviews: Product, Market, Tech, Critic.

## The idea, reset
**Job to be done:** "Let me dump anything about my life into one chat, the way I'd text a friend, and trust it to remember and remind me at the right time."
**Aha moment:** three weeks after a throwaway message, Jarvis texts *first*: "Dog ki flea dawai aaj due hai. Di?" → "haan" → logged, next one scheduled. No app opened.

**What we got wrong in v0.1–0.4:** we built a regex notebook (CLI plus web box) for a founder who wants to *chat* with an assistant that *messages him first*. We shipped 4 versions in a day with zero check-ins, and decided "LLM is a fallback" on our own. Reversed below.

## What it IS / IS NOT
- **IS:** one chat thread (Telegram), memory, proactive nudges with [Done][Snooze][Kal] buttons, answers about your own history, weekly recap.
- **IS NOT (yet):** a native app, dashboards, live carrier tracking, budgeting, two-way calendar sync, family sharing.
- **Wedge:** dog care + document expiries. Everything else is captured as notes.

## Top 5 use cases (frequency × pain)
1. "kal 5 baje vet" → reminder fires on time, no form. *(daily)*
2. Dog loop: "flea dawai di" → logged → next due computed → nudge. "last vaccine kab?" *(weekly)*
3. Idea/journal dump → Sunday recap. *(daily)*
4. Ask your memory: "passport kab expire?", "AC service last kab hua?" *(weekly)*
5. Expiries: passport, insurance, PUC, rent agreement → 90/30/7-day nudges. *(monthly, high pain)*

## Market
- Closest: Poke (texting AI, $19/mo, no pet or life-admin model), Meta AI / ChatGPT Tasks / Gemini Scheduled Actions (reminders, no structured life records), Mem ($12/mo notes), Rosebud (journal), Vetic (Indian pet app, clinic-locked), small WhatsApp reminder bots.
- **Gap:** an India-priced single chat that turns casual Hinglish into structured records that remind you, across life admin + pet + growth.
- **Channel:** Telegram first (free, no review, proactive messages OK). WhatsApp later and risky: since Jan 2026 Meta's Business API terms ban general-purpose AI assistants, and template messages cost money.
- **Risks:** platform giants add "remember + remind"; WhatsApp lock-out; low willingness to pay in India.

## Architecture (Tech)
**Telegram bot + small Python server + Claude API (tool use) + SQLite.** The artifact page stays as an optional dashboard.
- Rule parser = fast path (commands and confident captures, 0 tokens, target ≥60% of messages), plus a pre-parse hint for the LLM, deterministic Hinglish dates, and an offline fallback.
- Tools: `add_item`, `query_items`, `update_item`, `complete_item`, `set_reminder`, `log_metric`, `get_view`.
- Cost: Haiku for routine chat, Sonnet only for weekly review and photos; prompt caching; last 4 turns + ~150-token profile memory; scheduler uses templates (no LLM); hard cap ~$3/mo. Estimate: under $1/mo for one user.
- Host: home PC/Pi, Oracle free VM, or a ~$4 VPS. Long-polling, so no domain or HTTPS needed.

## Risks → mitigations (Critic)
| Risk | Mitigation |
|---|---|
| Everything-app, great at nothing | Wedge: dog + document expiries |
| Capture habit dies by week 2 | Live inside a chat app he already uses |
| Nudges ignored | ≤1 proactive message a day unless due; one-tap buttons |
| Trust with passport data | Store expiry dates only, never document numbers; read back every parsed date ("14 Mar 2027, sahi?") |
| "AI" is fake | LLM is the core; regex is the cheap pre-filter |

## Metrics
- **North star:** weekly *closed loops* (nudge or answer → Done/Snooze/useful reply).
- **Guardrails:** trust failures (wrong/late/missed reminder) ≈ 0; ignored nudges < 30%.

## 7-day validation (before building more)
A Telegram bot plus a morning nudge, used by the founder only. Pass = capture on ≥5/7 days, ≥3 items/day, ≥1 nudge → real action, and on day 7 "band kar dein toh miss karoge?" = yes. Miss → rethink; don't add features.

## Phases
- **P0 (this week):** Telegram bot on the existing parser, allowlisted chat_id, nudge loop every 15 min, 08:45 IST brief only if something is due, [Done][Snooze] buttons. Needs: bot token.
- **P1:** Claude tool-use chat (Hinglish replies, one clarifying question max), SQLite migration, usage cap. Needs: Anthropic API key.
- **P2:** photo → expiry extraction, Sunday recap on Sonnet, ICS feed, voice notes.

## Open questions for the founder
1. Telegram ok? (WhatsApp later)
2. Bot kahan chalega: apna laptop/PC, ya free cloud VM?
3. Voice notes chahiye? (haan/na)
