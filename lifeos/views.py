"""Read-only views over the store: today, dog dashboard, weekly review."""
from collections import Counter
from datetime import date, datetime, timedelta

ICONS = {"dog": "🐶", "document": "🛂", "package": "📦", "house": "🏠", "health": "💪",
         "money": "💰", "idea": "💡", "calendar": "📅", "journal": "📓"}
# How far ahead each domain shows up in `today`. Documents need months of notice to renew.
LEAD_DAYS = {"document": 90}
DEFAULT_LEAD = 7
PROMPTS = [
    "What gave you energy this week, and what drained it?",
    "One thing you're proud of, one thing you'd redo?",
    "What did the dog teach you this week?",
    "What are you avoiding? What's the smallest next step?",
    "Who do you want to spend more time with next week?",
    "What would make next week feel like a win?",
]


def days_left(item, today):
    return (date.fromisoformat(item["due"][:10]) - today).days


def rel(n):
    return "today" if n == 0 else "tomorrow" if n == 1 else f"in {n}d" if n > 0 else f"{-n}d overdue"


def fmt(item, today=None):
    check = "✔" if item.get("done") else " "
    due = ""
    if item.get("due"):
        due = f"  ⏰ {item['due']}" + (f" ({rel(days_left(item, today))})" if today else "")
    rep = ""
    if r := item.get("repeat"):
        rep = f"  🔁 every {r['unit']}" if r["every"] == 1 else f"  🔁 every {r['every']} {r['unit']}s"
    track = f"  #{' #'.join(item['tracking'])}" if item.get("tracking") else ""
    return f"[{check}] {item['id']:>3} {ICONS.get(item['domain'], '•')} {item['text']}{due}{rep}{track}"


def lines(items, empty="Nothing here.", today=None):
    return [fmt(i, today) for i in items] if items else [empty]


def today_view(items, today):
    open_due = sorted((i for i in items if i.get("due") and not i["done"]), key=lambda i: i["due"])
    overdue = [i for i in open_due if days_left(i, today) < 0]
    upcoming = [i for i in open_due
                if 0 <= days_left(i, today) <= LEAD_DAYS.get(i["domain"], DEFAULT_LEAD)]
    out = []
    if overdue:
        out += ["⚠️  Overdue", *lines(overdue, today=today), ""]
    out += [f"📆 Coming up (from {today})", *lines(upcoming, "Clear. Enjoy the day 🐾", today)]
    return out


def metric_series(items, name):
    return [(i["created"][:10], i["metric"]["value"]) for i in items
            if i.get("metric") and i["metric"]["name"] == name]


def trend(series):
    if not series:
        return "no data yet"
    pts = " → ".join(f"{v:g}" for _, v in series[-5:])
    delta = series[-1][1] - series[0][1] if len(series) > 1 else 0
    return f"{pts}  (latest {series[-1][0]}, {delta:+g} since {series[0][0]})"


def dog_view(items, today):
    dog = [i for i in items if i["domain"] == "dog"]
    todo = sorted((i for i in dog if not i["done"] and i.get("due")), key=lambda i: i["due"])
    health = [i for i in dog if any(w in i["text"].lower() for w in ("vaccin", "vet", "deworm", "flea", "tick"))]
    return [
        "🐶 Dog dashboard",
        f"⚖️  Weight: {trend(metric_series(items, 'dog.weight'))}",
        "",
        "📅 Scheduled", *lines(todo, "Nothing scheduled.", today),
        "",
        "💉 Health history", *lines(health[-5:], "No vet/vaccine records yet."),
    ]


def review_view(items, today):
    start = (today - timedelta(days=6)).isoformat()
    week = [i for i in items if i["created"][:10] >= start]
    completed = [i for i in items if (i.get("done_at") or "")[:10] >= start] + \
                [i for i in items if any((c or "")[:10] >= start for c in i.get("completions", []))]
    by_domain = Counter(i["domain"] for i in week)
    nxt = today + timedelta(days=7)
    coming = sorted((i for i in items if i.get("due") and not i["done"]
                     and today.isoformat() <= i["due"][:10] <= nxt.isoformat()), key=lambda i: i["due"])
    ideas = [i for i in week if i["domain"] == "idea"]
    out = [
        f"🗓️  Weekly review {start} → {today}",
        f"Captured {len(week)} · completed {len(completed)}",
        "  " + ("  ".join(f"{ICONS.get(d, '•')} {n}" for d, n in by_domain.most_common()) or "(nothing captured)"),
    ]
    for name, label in (("mood", "😊 Mood"), ("me.weight", "⚖️  Your weight"), ("dog.weight", "🐶 Dog weight")):
        series = [p for p in metric_series(items, name) if p[0] >= start]
        if series:
            out.append(f"{label}: {trend(series)}")
    if ideas:
        out += ["", "💡 Ideas this week", *lines(ideas)]
    out += ["", "⏭️  Next 7 days", *lines(coming, "Nothing scheduled.", today)]
    out += ["", f"✍️  Journal prompt: {PROMPTS[today.isocalendar()[1] % len(PROMPTS)]}",
            '   Answer with: life "journal: ..."']
    return out
