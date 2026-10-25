"""Build the installable phone app (PWA) into dist/ from app/lifeos.html + pwa/.

    python3 scripts/build_pwa.py            # then serve dist/ over HTTPS (GitHub Pages)
"""
import hashlib
import os
import json
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DIST = Path(os.environ.get("LIFEOS_DIST", ROOT / "dist"))  # override so parallel builds/tests don't collide
PUBLIC_URL = "https://novashiv11.github.io/lifeos/"  # where dist/ is served (GitHub Pages)
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

subprocess.run([sys.executable, str(ROOT / "scripts/build_app.py")], check=True)
page = (ROOT / "app/lifeos.html").read_text(encoding="utf-8")
HEAD = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0f0d" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#f3f6f3" media="(prefers-color-scheme: light)"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="LifeOS">
<link rel="manifest" href="manifest.json"><link rel="icon" href="icon-192.png"><link rel="apple-touch-icon" href="icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
"""
UI = sorted((ROOT / "app/ui").glob("*.js"))  # optional view modules (orb, stack, timeline…), loaded before the page script
HEAD = HEAD.replace("</head>", "".join(f'<script src="ui/{f.name}"></script>' for f in UI) + "</head>")
html = HEAD + page + '\n<script src="pwa.js"></script>\n</body></html>\n'

if DIST.exists():
    shutil.rmtree(DIST)
DIST.mkdir()
(DIST / "index.html").write_text(html, encoding="utf-8")
shutil.copy(ROOT / "pwa/pwa.js", DIST / "pwa.js")
shutil.copy(ROOT / "pwa/privacy.html", DIST / "privacy.html")
(DIST / "ui").mkdir()
for f in UI:
    shutil.copy(f, DIST / "ui" / f.name)
shutil.copytree(ROOT / "pwa/screens", DIST / "screens")
(DIST / "manifest.json").write_text(json.dumps({
    # `id` resolves against the ORIGIN, not the manifest URL: "./" would mean the whole novashiv11.github.io site and
    # collide with other apps hosted there (it made Chrome think LifeOS was "already installed"). Use the full path.
    "name": "LifeOS", "short_name": "LifeOS", "id": urlparse(PUBLIC_URL).path, "start_url": "./", "scope": "./",
    "description": "Type anything about your life. LifeOS sorts it, dates it and reminds you.",
    "related_applications": [{"platform": "webapp", "url": f"{PUBLIC_URL}manifest.json"}],
    "categories": ["productivity", "lifestyle", "health"],
    "screenshots": [{"src": "screens/today.png", "sizes": "780x1800", "type": "image/png", "form_factor": "narrow", "label": "Today: brief, renewals and guides"},
                    {"src": "screens/food.png", "sizes": "780x1688", "type": "image/png", "form_factor": "narrow", "label": "Scan food, track calories"}],
    "share_target": {"action": "./", "method": "GET", "params": {"title": "title", "text": "text", "url": "url"}},
    "shortcuts": [{"name": "Focus", "short_name": "Focus", "url": "./?v=stack"},
                  {"name": "Food", "short_name": "Food", "url": "./?v=food"},
                  {"name": "Money", "short_name": "Money", "url": "./?v=finance"},
                  {"name": "Jarvis", "short_name": "Jarvis", "url": "./?v=jarvis"}],
    "display": "standalone", "orientation": "portrait", "background_color": "#0b0f0d", "theme_color": "#0b0f0d",
    "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
              {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}],
}, indent=1), encoding="utf-8")
svg = (ROOT / "pwa/icon.svg").read_text()
from playwright.sync_api import sync_playwright  # dev-only dependency, used to rasterise the icon
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=CHROME)
    for size in (192, 512):
        pg = browser.new_page(viewport={"width": size, "height": size})
        pg.set_content(f"<style>html,body{{margin:0}}svg{{width:{size}px;height:{size}px;display:block}}</style>{svg}")
        pg.screenshot(path=str(DIST / f"icon-{size}.png"))
    browser.close()
(DIST / ".nojekyll").write_text("")
# Cache version covers every cached file, so any change (incl. manifest/icons) reaches installed apps.
version = hashlib.sha1(b"".join((DIST / n).read_bytes() for n in sorted(("index.html", "pwa.js", "manifest.json", "icon-192.png", "icon-512.png"))) + b"".join(f.read_bytes() for f in UI)
                       + (ROOT / "pwa/sw.js").read_bytes()).hexdigest()[:10]
(DIST / "sw.js").write_text((ROOT / "pwa/sw.js").read_text().replace("__VERSION__", version), encoding="utf-8")
print(f"Built {DIST} (version {version}):", ", ".join(sorted(p.name for p in DIST.iterdir())))
