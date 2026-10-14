"""Export dated, open items as an iCalendar file (RFC 5545) for Google/Apple Calendar import."""
from datetime import date, datetime, timedelta


FREQ = {"day": "DAILY", "week": "WEEKLY", "month": "MONTHLY", "year": "YEARLY"}
from .domains import lead_days


def _esc(s):
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def to_ics(items, stamp=None):
    stamp = (stamp or datetime.now()).strftime("%Y%m%dT%H%M%S")
    out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LifeOS//EN", "CALSCALE:GREGORIAN"]
    for it in items:
        if not it.get("due") or it["done"]:
            continue
        out += ["BEGIN:VEVENT", f"UID:lifeos-{it['id']}@local", f"DTSTAMP:{stamp}",
                f"SUMMARY:{_esc(it['text'])}", f"CATEGORIES:{it['domain'].upper()}"]
        if "T" in it["due"]:
            start = datetime.fromisoformat(it["due"])
            out += [f"DTSTART:{start:%Y%m%dT%H%M%S}", f"DTEND:{start + timedelta(hours=1):%Y%m%dT%H%M%S}"]
        else:
            d = date.fromisoformat(it["due"])
            out += [f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{d + timedelta(days=1):%Y%m%d}"]
        if r := it.get("repeat"):
            out.append(f"RRULE:FREQ={FREQ[r['unit']]};INTERVAL={r['every']}")
        if (n := min(lead_days(it), 30)) > 7:  # long-lead items (renewals) get an early alarm
            out += ["BEGIN:VALARM", "ACTION:DISPLAY", f"DESCRIPTION:{_esc(it['text'])}",
                    f"TRIGGER:-P{n}D", "END:VALARM"]
        out.append("END:VEVENT")
    out.append("END:VCALENDAR")
    return "\r\n".join(out) + "\r\n"
