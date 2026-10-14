"""Append-only JSONL store.

Each line is an item, or an op on an earlier item:
  {"op": "done", "id": N, "at": ts}               mark complete
  {"op": "advance", "id": N, "due": d, "at": ts}  recurring item moved to its next due date
  {"op": "edit", "id": N, "fields": {...}}        item re-parsed from new text
  {"op": "undo", "at": ts}                        cancels the latest record not already undone
"""
import json
import os
from datetime import date, datetime
from pathlib import Path

from .parse import add_interval


def home():
    return Path(os.environ.get("LIFEOS_HOME", Path.home() / ".lifeos"))


def _now():
    return datetime.now().isoformat(timespec="seconds")


class Store:
    def __init__(self, path=None):
        self.path = Path(path) if path else home() / "journal.jsonl"

    def _lines(self):
        if not self.path.exists():
            return []
        with self.path.open(encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    def _append(self, rec):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    def _effective(self):
        recs = []
        for rec in self._lines():
            if rec.get("op") == "undo":
                if recs:
                    recs.pop()
            else:
                recs.append(rec)
        return recs

    def items(self):
        items = {}
        for rec in self._effective():
            op, item = rec.get("op"), items.get(rec.get("id"))
            if op is None:
                items[rec["id"]] = {"repeat": None, "metric": None, **rec}
            elif item and op == "done":
                item.update(done=True, done_at=rec.get("at"))
            elif item and op == "edit":
                item.update(rec["fields"])
            elif item and op == "advance":
                item["due"] = rec["due"]
                item.setdefault("completions", []).append(rec.get("at"))
        return list(items.values())

    def get(self, item_id):
        return next((i for i in self.items() if i["id"] == item_id), None)

    def add(self, fields):
        next_id = max((i["id"] for i in self.items()), default=0) + 1
        rec = {"id": next_id, "created": _now(), "done": False, **fields}
        self._append(rec)
        return rec

    def edit(self, item_id, fields):
        if not self.get(item_id):
            return None
        self._append({"op": "edit", "id": item_id, "fields": fields, "at": _now()})
        return self.get(item_id)

    def undo(self):
        """Cancel the latest change. Returns a description of what was undone, or None."""
        recs = self._effective()
        if not recs:
            return None
        self._append({"op": "undo", "at": _now()})
        last = recs[-1]
        return f"{last.get('op', 'add')} #{last['id']}"

    def done(self, item_id, today=None):
        """Complete an item. Recurring items roll forward instead. Returns the updated item or None."""
        item = self.get(item_id)
        if not item:
            return None
        rep = item.get("repeat")
        if rep and item.get("due"):
            d, _, t = item["due"].partition("T")
            nxt = add_interval(date.fromisoformat(d), rep["every"], rep["unit"])
            # Catch up so the next due date is never in the past.
            while nxt < (today or date.today()):
                nxt = add_interval(nxt, rep["every"], rep["unit"])
            due = nxt.isoformat() + (f"T{t}" if t else "")
            self._append({"op": "advance", "id": item_id, "due": due, "at": _now()})
        else:
            self._append({"op": "done", "id": item_id, "at": _now()})
        return self.get(item_id)
