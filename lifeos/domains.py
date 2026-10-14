"""Life areas, lead times and metrics, loaded from life.json (shared with the web app)."""
import json
import re
from pathlib import Path

DATA = json.loads(Path(__file__).with_name("life.json").read_text(encoding="utf-8"))
AREAS = DATA["areas"]
FALLBACK = DATA["fallback"]
BY_ID = {a["id"]: a for a in AREAS} | {FALLBACK["id"]: FALLBACK}
LEGACY = {"dog": "pet", "house": "home", "package": "shopping"}  # ids used before v0.5

_AREA_RE = [(a["id"], re.compile(rf"\b(?:{'|'.join(a['keywords'])})\b", re.I)) for a in AREAS]
_OVERRIDES = [(re.compile(rf"\b(?:{o['pattern']})\b", re.I), o["days"]) for o in DATA["lead_overrides"]]
_METRICS = [(m, re.compile(m["pattern"], re.I)) for m in DATA["metrics"]]
_PET_RE = dict(_AREA_RE)["pet"]
UNITS = {m["name"]: m["unit"] for m in DATA["metrics"]}
SUMMED = {m["name"] for m in DATA["metrics"] if m.get("sum")}


def area(area_id):
    return BY_ID.get(LEGACY.get(area_id, area_id), FALLBACK)


def classify(text):
    # Explicit prefix wins: "idea: dog treat subscription" is an idea, not a pet item.
    if m := re.match(r"\s*(\w+)\s*:", text):
        d = LEGACY.get(m[1].lower(), m[1].lower())
        if d in BY_ID:
            return d
    for area_id, rx in _AREA_RE:
        if rx.search(text):
            return area_id
    return FALLBACK["id"]


def lead_days(item):
    """How many days ahead an item should surface: a matching override (most specific) beats the area default."""
    days = [d for rx, d in _OVERRIDES if rx.search(item["text"])]
    return max(days) if days else area(item["domain"])["lead"]


def parse_metrics(text):
    out = []
    for m, rx in _METRICS:
        if hit := rx.search(text):
            name = m["name"]
            if m.get("per_subject"):
                mine = re.search(r"\b(my|meri|mera)\b", text, re.I)
                name = ("pet." if _PET_RE.search(text) and not mine else "me.") + name
            out.append({"name": name, "value": float(hit[1].replace(",", "")), "unit": m["unit"]})
    return out


def unit(name):
    return UNITS.get(name.split(".")[-1], "")
