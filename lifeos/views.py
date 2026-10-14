"""Read-only views over the store: today, life wheel, one area, weekly review."""
from collections import Counter, defaultdict
from datetime import date, timedelta

from .domains import AREAS, SUMMED, area, lead_days, unit

PROMPTS = [
    "What gave you energy this week, and what drained it?",
    "One thing you're proud of, one thing you'd redo?",
    "Which part of your life got no attention this week?",
    "What are you avoiding? What's the smallest next step?",
    "Who do you want to spend more time with next week?",
    "What would make next week feel like a win?",
]


def days_left(item, today):
    return (date.fromisoformat(item["due"][:10]) - today).days


def rel(n):
    return "today" if n == 0 else "tomorrow" if n == 1 else f"in {n}d" if n > 0 else f"{-n}d overdue"


def icon(item):
    return area(item["domain"])["icon"]


def fmt(item, today=None):
    check = "✔" if item.get("done") else " "
    due = ""
    if item.get("due"):
        due = f"  ⏰ {item['due']}" + (f" ({rel(days_left(item, today))})" if today else "")
    rep = ""
    if r := item.get("repeat"):
        rep = f"  🔁 every {r['unit']}" if r["every"] == 1 else f"  🔁 every {r['every']} {r['unit']}s"
    track = f"  #{' #'.join(item['tracking'])}" if item.get("tracking") else ""
    return f"[{check}] {item['id']:>3} {icon(item)} {item['text']}{due}{rep}{track}"


def lines(items, empty="Nothing here.", today=None):
    return [fmt(i, today) for i in items] if items else [empty]


def open_dated(items):
    return sorted((i for i in items if i.get("due") and not i["done"]), key=lambda i: i["due"])


def today_view(items, today):
    open_due = open_dated(items)
    overdue = [i for i in open_due if days_left(i, today) < 0]
    upcoming = [i for i in open_due if 0 <= days_left(i, today) <= lead_days(i)]
    out = []
    if overdue:
        out += ["⚠️  Overdue", *lines(overdue, today=today), ""]
    out += [f"📆 Coming up (from {today})", *lines(upcoming, "Clear. Enjoy the day 🌿", today)]
    return out


# ---- metrics -------------------------------------------------------------

def metric_points(items, since=None):
    """{name: [(date, value), ...]} in capture order."""
    pts = defaultdict(list)
    for i in sorted(items, key=lambda i: i["id"]):
        day = i["created"][:10]
        if since and day < since:
            continue
        for m in i.get("metrics") or []:
            pts[m["name"]].append((day, m["value"]))
    return pts


def metric_line(name, series):
    u = unit(name)
    vals = [v for _, v in series]
    if name.split(".")[-1] in SUMMED:
        return f"{name}: total {sum(vals):g}{u} over {len(vals)} entries"
    trail = " → ".join(f"{v:g}" for v in vals[-5:])
    avg = sum(vals) / len(vals)
    return f"{name}: {trail} {u} (avg {avg:.1f})"


# ---- life wheel & areas -------------------------------------------------

def wheel_view(items, today):
    """Every life area at a glance: what's open, what's next, and which areas are untouched."""
    by_area = defaultdict(list)
    for i in items:
        by_area[area(i["domain"])["id"]].append(i)
    out, quiet = ["🧭 Your life at a glance"], []
    for a in AREAS + [area("journal")]:
        its = by_area.get(a["id"], [])
        if not its:
            quiet.append(a["label"])
            continue
        open_n = sum(not i["done"] for i in its)
        nxt = open_dated(its)
        nxt_s = f" · next: {nxt[0]['text'][:40]} ({rel(days_left(nxt[0], today))})" if nxt else ""
        last = max(i["created"][:10] for i in its)
        out.append(f"{a['icon']} {a['label']}: {open_n} open{nxt_s} · last {last}")
    if quiet:
        out += ["", "Not tracking yet: " + ", ".join(quiet), "Try `life areas` for examples."]
    return out


def areas_view():
    out = ["🗺️  Life areas (type naturally; these are examples)"]
    for a in AREAS:
        out += [f"{a['icon']} {a['label']} [{a['id']}] — {a['covers']}",
                "   e.g. " + " · ".join(f'"{e}"' for e in a["examples"][:2])]
    return out


def area_view(items, area_id, today):
    a = area(area_id)
    its = [i for i in items if area(i["domain"])["id"] == a["id"]]
    sched = open_dated(its)
    notes = sorted((i for i in its if not i.get("due") and not i["done"]), key=lambda i: -i["id"])[:5]
    history = sorted((i for i in its if i["done"] or i.get("completions")), key=lambda i: -i["id"])[:5]
    pts = metric_points(its)
    out = [f"{a['icon']} {a['label']}", f"   {a['covers']}"]
    if pts:
        out += ["", "📈 Tracked", *("   " + metric_line(n, s) for n, s in pts.items())]
    out += ["", "📅 Scheduled", *lines(sched, "Nothing scheduled.", today),
            "", "📝 Notes", *lines(notes, "No notes yet."),
            "", "✅ History", *lines(history, "Nothing completed yet."),
            "", f"💡 {a['tip']}"]
    return out


def review_view(items, today):
    start = (today - timedelta(days=6)).isoformat()
    week = [i for i in items if i["created"][:10] >= start]
    completed = sum((i.get("done_at") or "")[:10] >= start for i in items) + \
        sum((c or "")[:10] >= start for i in items for c in i.get("completions", []))
    by_area = Counter(area(i["domain"])["id"] for i in week)
    nxt = (today + timedelta(days=7)).isoformat()
    coming = [i for i in open_dated(items) if today.isoformat() <= i["due"][:10] <= nxt]
    ideas = [i for i in week if i["domain"] == "idea"]
    touched = set(by_area)
    used_before = {area(i["domain"])["id"] for i in items} - touched
    out = [
        f"🗓️  Weekly review {start} → {today}",
        f"Captured {len(week)} · completed {completed}",
        "  " + ("  ".join(f"{area(d)['icon']} {n}" for d, n in by_area.most_common()) or "(nothing captured)"),
    ]
    pts = metric_points(items, since=start)
    if pts:
        out += ["", "📈 This week", *("   " + metric_line(n, s) for n, s in pts.items())]
    if used_before:
        out += ["", "🌫️  Quiet this week: " + ", ".join(area(a)["label"] for a in sorted(used_before))]
    if ideas:
        out += ["", "💡 Ideas this week", *lines(ideas)]
    out += ["", "⏭️  Next 7 days", *lines(coming, "Nothing scheduled.", today)]
    out += ["", f"✍️  Journal prompt: {PROMPTS[today.isocalendar()[1] % len(PROMPTS)]}",
            '   Answer with: life "journal: ..."']
    return out
