"""Inject lifeos/life.json into app/lifeos.html so the web app and the Python package share one life map.

Run after editing life.json:  python3 scripts/build_app.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
life = json.loads((ROOT / "lifeos/life.json").read_text(encoding="utf-8"))
life.pop("_doc", None)
page = ROOT / "app/lifeos.html"
src = page.read_text(encoding="utf-8")
blob = json.dumps(life, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
new, n = re.subn(r"/\*LIFE\*/.*?/\*END_LIFE\*/", lambda _: f"/*LIFE*/{blob}/*END_LIFE*/", src, flags=re.S)
if n != 1:
    raise SystemExit("marker /*LIFE*/…/*END_LIFE*/ not found exactly once in app/lifeos.html")
page.write_text(new, encoding="utf-8")
print(f"Injected {len(life['areas'])} areas into {page.relative_to(ROOT)}")
