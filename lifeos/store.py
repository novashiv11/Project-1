"""Append-only JSONL store. Each line is an item or an op ({"op": "done", "id": N})."""
import json
import os
from datetime import datetime
from pathlib import Path


def home():
    return Path(os.environ.get("LIFEOS_HOME", Path.home() / ".lifeos"))


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

    def items(self):
        items = {}
        for rec in self._lines():
            if rec.get("op") == "done":
                if rec["id"] in items:
                    items[rec["id"]]["done"] = True
            else:
                items[rec["id"]] = rec
        return list(items.values())

    def add(self, fields):
        next_id = max((i["id"] for i in self.items()), default=0) + 1
        rec = {"id": next_id, "created": datetime.now().isoformat(timespec="seconds"), "done": False, **fields}
        self._append(rec)
        return rec

    def done(self, item_id):
        if not any(i["id"] == item_id for i in self.items()):
            return False
        self._append({"op": "done", "id": item_id, "at": datetime.now().isoformat(timespec="seconds")})
        return True
