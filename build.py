#!/usr/bin/env python3
"""Static site generator for the tools site.

Each file in tools/ is one page:

    <!--meta
    {"slug": "...", "title": "...", "description": "...", "faq": [["Q", "A"], ...]}
    -->
    ...tool HTML + <script>...
    <!--content-->
    ...explanatory article HTML (helps people + search engines)...

Files in pages/ use the same meta block but have no tool section.
Run:  python3 build.py   -> writes the site to _site/
"""
import datetime
import html
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "_site"
CFG = json.loads((ROOT / "config.json").read_text())
META_RE = re.compile(r"<!--meta\s*(\{.*?\})\s*-->", re.S)
# Home page section order; tools without a "category" are calculators.
CATEGORIES = ["PDF tools", "Image tools", "QR & utility tools", "Calculators"]


def parse(path):
    text = path.read_text()
    m = META_RE.search(text)
    if not m:
        raise SystemExit(f"{path}: missing <!--meta {{...}} --> block")
    meta = json.loads(m.group(1))
    body = text[m.end():]
    tool, _, content = body.partition("<!--content-->")
    if not content:
        tool, content = "", tool
    meta.setdefault("category", "Calculators")
    meta.update(tool=tool.strip(), content=content.strip())
    return meta


def ad_slot():
    if not CFG["adsense_client"]:
        return ""
    return (
        '<div class="ad"><ins class="adsbygoogle" style="display:block" '
        f'data-ad-client="{CFG["adsense_client"]}" data-ad-format="auto" '
        'data-full-width-responsive="true"></ins>'
        "<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>"
    )


def affiliates(slug):
    # A link with a "tools" list only shows on those tool pages; without one it shows everywhere.
    links = [l for l in CFG.get("affiliate_links") or [] if slug in l.get("tools", [slug])]
    if not links:
        return ""
    items = "".join(
        f'<li><a href="{html.escape(l["url"])}" rel="sponsored noopener" target="_blank">'
        f'{html.escape(l["text"])}</a></li>'
        for l in links
    )
    return f'<div class="card aff"><strong>Recommended</strong><ul>{items}</ul></div>'


def layout(meta, main, depth):
    base = "../" * depth
    url = f'{CFG["site_url"]}/{meta["slug"] + "/" if meta["slug"] else ""}'
    head_extra = ""
    if CFG["adsense_client"]:
        head_extra += (
            '<script async src="https://pagead2.googlesyndication.com/pagead/js/'
            f'adsbygoogle.js?client={CFG["adsense_client"]}" crossorigin="anonymous"></script>'
        )
    if meta.get("faq"):
        ld = {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in meta["faq"]
            ],
        }
        head_extra += f'<script type="application/ld+json">{json.dumps(ld)}</script>'
    title = meta["title"] if not meta["slug"] else f'{meta["title"]} | {CFG["site_name"]}'
    year = datetime.date.today().year
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(meta["description"])}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{html.escape(meta["title"])}">
<meta property="og:description" content="{html.escape(meta["description"])}">
<meta property="og:url" content="{url}">
<link rel="icon" href="{base}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{base}style.css">
{head_extra}
</head><body>
<header><div class="wrap"><a class="logo" href="{base}">{html.escape(CFG["site_name"])}</a>
<nav><a href="{base}">All tools</a><a href="{base}about/">About</a></nav></div></header>
<main class="wrap">
{main}
</main>
<footer><div class="wrap">&copy; {year} {html.escape(CFG["site_name"])} &middot;
<a href="{base}about/">About</a> &middot; <a href="{base}privacy/">Privacy</a> &middot;
All calculations run in your browser. Results are estimates, not financial or medical advice.</div></footer>
</body></html>
"""


def faq_html(faq):
    if not faq:
        return ""
    items = "".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in faq)
    return f"<h2>Frequently asked questions</h2>{items}"


def related(tool, tools, n=6):
    same = [t for t in tools if t["category"] == tool["category"] and t is not tool][:n]
    if not same:
        return ""
    links = "".join(f'<a class="card" href="../{t["slug"]}/"><strong>{t["title"]}</strong></a>' for t in same)
    return f'<h2>Related tools</h2><div class="grid">{links}</div>'


# Filters the home page cards as the visitor types; hides empty categories.
SEARCH_JS = """<script>
q.addEventListener('input',()=>{const w=q.value.toLowerCase().trim().split(/\\s+/);let any=0;
 document.querySelectorAll('#cats .grid').forEach(g=>{let n=0;
  g.querySelectorAll('a').forEach(a=>{const t=a.textContent.toLowerCase(),ok=w.every(x=>t.includes(x));a.hidden=!ok;n+=ok;});
  g.hidden=g.previousElementSibling.hidden=!n;any+=n;});
 none.hidden=!!any;});
</script>"""


def write(slug, page):
    dest = OUT / slug / "index.html" if slug else OUT / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(page)


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ROOT / "static", OUT, dirs_exist_ok=True)

    tools = sorted((parse(p) for p in (ROOT / "tools").glob("*.html")), key=lambda t: t["title"])
    pages = [parse(p) for p in (ROOT / "pages").glob("*.html")]

    for t in tools:
        main_html = (
            f'<h1>{t["title"]}</h1><p class="muted">{t["description"]}</p>'
            f'<div class="card">{t["tool"]}</div>{ad_slot()}'
            f'<article>{t["content"]}</article>{affiliates(t["slug"])}{faq_html(t.get("faq"))}{ad_slot()}'
            f'{related(t, tools)}'
        )
        write(t["slug"], layout(t, main_html, 1))

    for p in pages:
        body = p["content"].replace("{{site_name}}", CFG["site_name"]).replace(
            "{{contact_email}}", CFG["contact_email"])
        write(p["slug"], layout(p, f'<h1>{p["title"]}</h1>{body}', 1))

    cats = sorted({t["category"] for t in tools},
                  key=lambda c: CATEGORIES.index(c) if c in CATEGORIES else len(CATEGORIES))
    cards = "".join(
        f'<h2>{c}</h2><div class="grid">' + "".join(
            f'<a class="card" href="{t["slug"]}/"><strong>{t["title"]}</strong>'
            f'<span>{t["description"]}</span></a>'
            for t in tools if t["category"] == c) + "</div>"
        for c in cats
    )
    home = {"slug": "", "title": f'{CFG["site_name"]} - {CFG["tagline"]}',
            "description": CFG["tagline"] + ". No sign-up, nothing to install."}
    write("", layout(home,
                     f'<h1>{CFG["site_name"]}</h1><p class="muted">{CFG["tagline"]}. '
                     f'No sign-up, nothing to install, your data never leaves your device.</p>'
                     f'<input id="q" type="search" placeholder="Search {len(tools)} tools, e.g. merge pdf, passport photo, EMI" '
                     f'aria-label="Search tools" autocomplete="off">'
                     f'<p id="none" class="muted" hidden>No tool found. Try another word.</p>'
                     f'{ad_slot()}<div id="cats">{cards}</div>{SEARCH_JS}', 0))

    today = datetime.date.today().isoformat()
    slugs = [""] + [t["slug"] for t in tools] + [p["slug"] for p in pages]
    urls = "".join(
        f'<url><loc>{CFG["site_url"]}/{s + "/" if s else ""}</loc><lastmod>{today}</lastmod></url>'
        for s in slugs
    )
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    (OUT / "robots.txt").write_text(f'User-agent: *\nAllow: /\nSitemap: {CFG["site_url"]}/sitemap.xml\n')
    if CFG["adsense_client"]:
        pub = CFG["adsense_client"].replace("ca-", "")
        (OUT / "ads.txt").write_text(f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n")
    (OUT / ".nojekyll").write_text("")
    print(f"Built {len(tools)} tools and {len(pages)} pages into {OUT}")


if __name__ == "__main__":
    main()
