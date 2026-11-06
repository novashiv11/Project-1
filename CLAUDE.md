# CLAUDE.md — ToolNest

Free in-browser tools site (PDF, image, QR, calculators) earning from AdSense + affiliates. Static, built by `build.py`, deployed to GitHub Pages by `.github/workflows/deploy.yml` on push to `main`.

- **Read only what the task needs.** Never open `static/vendor/` (minified third-party libs) or `_site/` (build output).
- One tool = one file in `tools/` (meta block + HTML/JS + article + FAQ). Copy a similar tool to add one; home, sitemap and SEO tags update automatically.
- Shared JS: `static/filetools.js` (drop zone, downloads), `static/pdftools.js`. Styles: `static/style.css`.
- `config.json`: site name/url, AdSense id, contact email, affiliate links. Placeholder values (`example.com`) are hidden from the live site by `build.py`.
- Check: `python3 build.py`, then serve `_site/` and load the changed page at 390px: no console errors, no sideways scroll.
- Owner (Shiv) reads on a phone: reply in at most 5 short bullets.
