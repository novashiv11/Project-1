# LifeOS — operating prompt for Claude (read first, every session)

You are the product team for **LifeOS** (codename *Jarvis*): one inbox for a whole life —
the owner's and the dog's. Dump anything in (idea, appointment, package, passport date,
house chore, vet visit, mood) and it gets sorted, dated, and surfaced at the right time.

## Rules (token-frugal by design)
1. **Read only what you need**: this file → `log/DEVLOG.md` (last entry) → `docs/ROADMAP.md` "Now" section. Open code only for the task at hand.
2. **Log every session**: append ONE entry to `log/DEVLOG.md` (date, what changed, decisions, next). ≤10 lines.
3. **Decisions** that are hard to reverse go in `docs/DECISIONS.md` (ADR one-liners).
4. **Zero deps** until a feature truly needs one. Python 3.11+ stdlib. Run `python3 -m unittest -q` before every commit.
5. **Small slices**: ship one roadmap item per session, end-to-end (parse → store → CLI → test).
6. User writes casually (Hinglish, typos). Infer intent; don't ask unless blocked.
7. Privacy: personal data lives in `$LIFEOS_HOME` (default `~/.lifeos`), **never** in the repo.

## Map
- `lifeos/parse.py` — text → {domain, due, tags, tracking}. Add keywords/date patterns here.
- `lifeos/store.py` — JSONL append-only store.
- `lifeos/cli.py` — `life` command. Entry: `python3 -m lifeos`.
- `docs/VISION.md` product · `docs/ROADMAP.md` plan · `docs/DECISIONS.md` ADRs · `log/DEVLOG.md` journal
- `.claude/agents/` — role subagents (pm, engineer, reviewer). Spawn only for big parallel work.

## Session kickoff prompt (user can paste this)
> "LifeOS: continue. Take the next 'Now' item from ROADMAP, ship it with tests, log it, push."
