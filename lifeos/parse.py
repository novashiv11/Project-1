"""Turn a free-text line into structured fields. Rule-based, offline, deterministic."""
import re
from datetime import date, datetime, time, timedelta

from .domains import classify, parse_metrics

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
TIME_RE = re.compile(r"\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b", re.I)




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


# A date right after "paid / delivered / was …" is history, not a due date ("last paid 27 Oct 2025").
_DATE_ANY = (rf"(?:\d{{1,2}}(?:st|nd|rd|th)?\s+{_MON}(?:\s+\d{{4}})?|{_MON}\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+\d{{4}})?"
             rf"|\d{{4}}-\d{{2}}-\d{{2}}|\d{{1,2}}/\d{{1,2}}/\d{{4}})")
PAST_RE = re.compile(rf"\b(?:last\s+paid|paid|delivered|was|since|bought|ordered|received|submitted|applied)\s+(?:on\s+)?{_DATE_ANY}")


def parse_date(text, today):
    t = PAST_RE.sub(" ", text.lower())
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
    # Explicit calendar dates beat weekday words ("Black Friday on 27 Nov" is 27 Nov, not this Friday).
    if m := re.search(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+{_MON}(?:\s+(\d{{4}}))?\b", t):
        if d := _month_day(m[2], m[1], m[3], today):
            return d
    if m := re.search(rf"\b{_MON}\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{4}}))?\b", t):
        if d := _month_day(m[1], m[2], m[3], today):
            return d
    if m := re.search(rf"\b{_MON}\s+(\d{{4}})\b", t):  # "Nov 2026" → 1 Nov 2026
        return date(int(m[2]), MONTHS.index(m[1][:3]) + 1, 1)
    if m := re.search(rf"\b(next\s+)?({'|'.join(WEEKDAYS)})\b", t):
        delta = (WEEKDAYS.index(m[2]) - today.weekday()) % 7 or 7
        return today + timedelta(days=delta)
    for idx, pat in enumerate(HI_WEEKDAYS):
        if re.search(rf"\b(?:{pat})(?:\s+ko)?\b", t):
            return today + timedelta(days=(idx - today.weekday()) % 7 or 7)
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
    if due and not repeat and re.search(r"\b(birthday|bday|anniversary)\b", text, re.I):
        repeat = {"every": 1, "unit": "year"}
    if repeat and not due and repeat["unit"] == "month":  # "every month on the 5th" → next 5th
        if m := re.search(r"\b(\d{1,2})(?:st|nd|rd|th)\b", text, re.I):
            day, t0 = int(m[1]), now.date()
            if 1 <= day <= 28:
                due = t0.replace(day=day) if day >= t0.day else add_interval(t0.replace(day=day), 1, "month")
    if repeat and not due:
        due = now.date()
    due_str = None
    if due:
        tm = _parse_time(text)
        due_str = datetime.combine(due, tm).isoformat(timespec="minutes") if tm else due.isoformat()
    tracking = TRACKING_RE.findall(text)
    domain = classify(text)
    if tracking and domain == "journal":
        domain = "shopping"
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
        "metrics": parse_metrics(text),
    }
