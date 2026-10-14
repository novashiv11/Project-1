# LifeOS (codename Jarvis)

A personal life operating system for you **and your dog**: throw random thoughts at it,
it figures out what they are and reminds you at the right time.

```bash
python3 -m lifeos "dog vet appointment next friday 5pm"
python3 -m lifeos "passport expires 2027-03-14"
python3 -m lifeos "amazon package 1Z999AA10123456784 arriving tomorrow"
python3 -m lifeos "idea: app that rates chai stalls"
python3 -m lifeos today          # overdue + next 7 days
python3 -m lifeos list --domain dog
python3 -m lifeos search passport
python3 -m lifeos done 3
```

Data is stored locally in `~/.lifeos/journal.jsonl` (override with `LIFEOS_HOME`).

See `docs/VISION.md` and `docs/ROADMAP.md`. Dev log: `log/DEVLOG.md`.
