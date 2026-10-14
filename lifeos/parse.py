"""Turn a free-text line into structured fields. Rule-based, offline, deterministic."""
import re
from datetime import date, datetime, time, timedelta

# Checked in order: first domain with a keyword hit wins.
DOMAINS = [
    ("dog", r"dog|puppy|pup|vet|walkies|kibble|flea|tick|groom\w*|leash|deworm\w*"),
    ("document", r"passport|visa|licen[cs]e|aadhaar|pan card|insurance|id card|expir\w*|renew\w*"),
    ("package", r"package|parcel|deliver\w*|courier|shipped|shipment|tracking|order(?:ed)?"),
    ("house", r"house|home|rent|landlord|plumber|electrician|repair\w*|fridge|ac|wifi|bill|mortgage|maintenance|chore\w*"),
    ("health", r"doctor|dentist|gym|workout|medicine|meds|sleep|run|ran|running|yoga|weight"),
    ("money", r"pay|paid|salary|emi|invest\w*|spent|budget|loan|tax"),
    ("idea", r"idea|what if|app that|startup|business"),
    ("calendar", r"meeting|appointment|call|birthday|anniversary|event|party|flight|trip"),
]
ICONS_DOMAINS = {d for d, _ in DOMAINS} | {"journal"}
DOMAIN_RE = [(d, re.compile(rf"\b(?:{p})\b", re.I)) for d, p in DOMAINS]

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
# Hinglish weekday names, same index as WEEKDAYS.
HI_WEEKDAYS = ["som[vw]ar", "mangal[vw]ar", "budh[vw]ar", "guru[vw]ar|brihaspati[vw]ar",
               "shukra[vw]ar", "shani[vw]ar", "ravi[vw]ar|it[vw]ar"]
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
_MON = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*"

TRACKING_RE = re.compile(r"\b(1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2}|\d{12,22})\b")
TAG_RE = re.compile(r"(?<!\w)#(\w+)")
REPEAT_RE = re.compile(
    r"\bevery\s+(?:(\d+|other)\s+)?(day|week|month|year)s?\b"
    r"|\b(daily|weekly|monthly|yearly|annually)\b"
    rf"|\bevery\s+({'|'.join(WEEKDAYS)})\b", re.I)
_ADVERB = {"daily": "day", "weekly": "week", "monthly": "month", "yearly": "year", "annually": "year"}
METRIC_RE = re.compile(r"\b(dog|my)?\s*weight\s*(?:is\s*|=\s*|:\s*)?(\d+(?:\.\d+)?)\s*kg\b"
                       r"|\bmood\s*(?:is\s*|:\s*)?(\d{1,2})(?:\s*/\s*10)?\b", re.I)
TIME_RE = re.compile(r"\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b", re.I)


def classify(text):
    # Explicit prefix wins: "idea: dog treat subscription" is an idea, not a dog item.
    if m := re.match(r"\s*(\w+)\s*:", text):
        if (d := m[1].lower()) in ICONS_DOMAINS:
            return d
    for domain, rx in DOMAIN_RE:
        if rx.search(text):
            return domain
    return "journal"


def _parse_time(text):
    m = TIME_RE.search(text)
    if not m:
        return None
    if m.group(1):
        h, mi, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3).lower()
        if h > 12:
            return None
        h = h % 12 + (12 if ap == "pm" else 0)
    else:
        h, mi = int(m.group(4)), int(m.group(5))
    return time(h, mi) if h < 24 and mi < 60 else None


def _month_day(mon, day, year, today):
    m = MONTHS.index(mon[:3].lower()) + 1
    y = int(year) if year else today.year
    try:
        d = date(y, m, int(day))
    except ValueError:
        return None
    if not year and d < today:
        d = d.replace(year=y + 1)
    return d


def parse_date(text, today):
    t = text.lower()
    if m := re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", t):
        try:
            return date(*map(int, m.groups()))
        except ValueError:
            pass
    if m := re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", t):  # dd/mm/yyyy
        try:
            return date(int(m[3]), int(m[2]), int(m[1]))
        except ValueError:
            pass
    if re.search(r"\b(today|tonight|aaj|aj)\b", t):
        return today
    if re.search(r"\b(tomorrow|tmrw|tmr|kal)\b", t):  # "kal" is read as tomorrow: we capture plans
        return today + timedelta(days=1)
    if re.search(r"\b(parso|parson)\b", t):
        return today + timedelta(days=2)
    if re.search(r"\b(next week|agle hafte|agle week)\b", t):
        return today + timedelta(days=7)
    if m := re.search(r"\b(\d+)\s+din\s+(?:baad|bad|mein|me)\b", t):
        return today + timedelta(days=int(m[1]))
    if m := re.search(r"\bin\s+(\d+)\s+(day|week|month|year)s?\b", t):
        n, unit = int(m[1]), m[2]
        days = {"day": 1, "week": 7, "month": 30, "year": 365}[unit] * n
        return today + timedelta(days=days)
    if m := re.search(rf"\b(next\s+)?({'|'.join(WEEKDAYS)})\b", t):
        delta = (WEEKDAYS.index(m[2]) - today.weekday()) % 7 or 7
        return today + timedelta(days=delta)
    for idx, pat in enumerate(HI_WEEKDAYS):
        if re.search(rf"\b(?:{pat})(?:\s+ko)?\b", t):
            return today + timedelta(days=(idx - today.weekday()) % 7 or 7)
    if m := re.search(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+{_MON}(?:\s+(\d{{4}}))?\b", t):
        return _month_day(m[2], m[1], m[3], today)
    if m := re.search(rf"\b{_MON}\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{4}}))?\b", t):
        return _month_day(m[1], m[2], m[3], today)
    return None


def parse_repeat(text):
    m = REPEAT_RE.search(text)
    if not m:
        return None
    if m[2]:
        n = 2 if (m[1] or "").lower() == "other" else int(m[1] or 1)
        return {"every": n, "unit": m[2].lower()}
    if m[3]:
        return {"every": 1, "unit": _ADVERB[m[3].lower()]}
    return {"every": 1, "unit": "week"}


def parse_metric(text):
    m = METRIC_RE.search(text)
    if not m:
        return None
    if m[2]:
        who = "dog" if (m[1] or "").lower() == "dog" or re.search(r"\bdog\b", text, re.I) else "me"
        return {"name": f"{who}.weight", "value": float(m[2])}
    return {"name": "mood", "value": float(m[3])}


def add_interval(d, every, unit):
    """Add a repeat interval to a date, clamping month-ends (Jan 31 + 1 month = Feb 28)."""
    if unit in ("day", "week"):
        return d + timedelta(days=every * (7 if unit == "week" else 1))
    months = every * (12 if unit == "year" else 1)
    y, m = divmod(d.month - 1 + months, 12)
    y, m = d.year + y, m + 1
    for day in range(d.day, 27, -1):
        try:
            return d.replace(year=y, month=m, day=day)
        except ValueError:
            continue
    return d.replace(year=y, month=m, day=min(d.day, 28))


def parse(text, now=None):
    now = now or datetime.now()
    due = parse_date(text, now.date())
    repeat = parse_repeat(text)
    if repeat and not due:
        due = now.date()
    due_str = None
    if due:
        tm = _parse_time(text)
        due_str = datetime.combine(due, tm).isoformat(timespec="minutes") if tm else due.isoformat()
    tracking = TRACKING_RE.findall(text)
    domain = classify(text)
    if tracking and domain == "journal":
        domain = "package"
    explicit = re.match(r"\s*(?:idea|journal)\s*:", text, re.I)
    if due and domain in ("journal", "idea") and not explicit and not re.search(r"\bidea\b", text, re.I):
        domain = "calendar"
    return {
        "text": text.strip(),
        "domain": domain,
        "due": due_str,
        "tags": TAG_RE.findall(text),
        "tracking": tracking,
        "repeat": repeat,
        "metric": parse_metric(text),
    }
