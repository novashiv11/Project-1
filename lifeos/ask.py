"""Answer questions from the store with keyword overlap. Offline stand-in for the future LLM path."""
import re
from datetime import date

from .views import days_left, fmt, rel

STOP = set("""a an the is are was were be been of to for in on at by my our your me i we it its this that
what when where which who how do does did is any next last ka ki ke kab hai kya mera meri mere""".split())
SYNONYMS = {"vaccine": {"vaccination", "shot", "jab", "rabies"}, "vet": {"doctor"},
            "passport": {"visa", "document"}, "rent": {"landlord"}, "package": {"parcel", "delivery", "order"}}


def tokens(text):
    words = {w.rstrip("s") for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP}
    for key, syns in SYNONYMS.items():
        if key in words or words & syns:
            words |= {key, *syns}
    return words


def answer(question, items, today=None, limit=3):
    today = today or date.today()
    q = tokens(question)
    scored = []
    for it in items:
        hit = len(q & tokens(it["text"]))
        if hit:
            # Prefer open, upcoming items; then the nearest due date; then the newest.
            upcoming = bool(it.get("due")) and not it["done"] and days_left(it, today) >= 0
            scored.append((-hit, not upcoming, it.get("due") or "9999", -it["id"], it))
    best = [s[-1] for s in sorted(scored, key=lambda s: s[:4])[:limit]]
    if not best:
        return ["🤷 Nothing in your journal matches that yet."]
    top = best[0]
    head = f"👉 {top['text']}"
    if top.get("due"):
        head += f" — {top['due']} ({rel(days_left(top, today))})"
    out = [head]
    if len(best) > 1:
        out += ["", "Related:", *(fmt(i, today) for i in best[1:])]
    return out
