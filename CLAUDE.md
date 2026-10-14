# LifeOS / Jarvis: self-prompt (read first, every session)

**Product:** a Telegram chat assistant. Founder texts anything in Hinglish → it stores structured records → it messages him first when something is due → he can ask about his own history. Wedge: dog care + document expiries. Full plan: `docs/STRATEGY.md`.

## Talking to the founder (most important)
- Reply in **≤5 lines, Hinglish, plain words**. No walls of text. Details go in files, not chat.
- **Decide before building:** propose → he says "haan" → build. End each update with ONE question (2–3 options + a default).
- Show it working on **his phone** (screenshot or bot message), not terminal output.
- Never hide blockers in logs; ask for tokens/keys up front.

## Working rules (usage-optimised)
1. Read only: this file → last entry of `log/DEVLOG.md` → "Now" in `docs/ROADMAP.md`. Open code only for the current task.
2. One roadmap item per session, end to end, with tests: `python3 -m unittest -q`.
3. Append ≤8 lines to `log/DEVLOG.md`; hard-to-reverse calls go to `docs/DECISIONS.md` (one line).
4. Do the work inline. Spawn role agents (`.claude/agents/`) only for parallel research or reviews of big changes; ask them for ≤400-word output.
5. LLM cost: Haiku by default, Sonnet only for recap/photos; cache system prompt + tools; never send full history.
6. Privacy: personal data lives in `$LIFEOS_HOME`, never in the repo. Store expiry dates, never document numbers.
7. Python 3.11+ stdlib until a dependency clearly pays for itself.

## Map
- `lifeos/life.json` **life map: 16 areas, keywords, lead times, metrics** (single source; run `scripts/build_app.py` after editing) · `domains.py` loads it
- `lifeos/parse.py` dates/repeats (fast path + LLM hint) · `store.py` append-only store · `views.py` today/dog/review text
- `lifeos/ask.py` keyword Q&A · `ics.py` calendar export · `web.py` local web UI · `cli.py` `life` command
- `app/lifeos.html` live web app (https://claude.ai/artifact/EjccpLbiwHgHC6A3J9Z9Xy); JS mirror of parse.py, guarded by tests/test_parity.py
- Next: `lifeos/telegram.py` (P0 bot), then `lifeos/brain.py` (Claude tool use)

## Kickoff line the founder can paste
> "Jarvis: continue. Next 'Now' item, ask me if blocked, ship, 5-line update."
