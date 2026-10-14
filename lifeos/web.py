"""`life serve` — one-box web UI over the CLI. Type exactly what you'd type after `life`.

Binds to 127.0.0.1 by default. Exposing it (e.g. --host 0.0.0.0 for your phone on home Wi-Fi)
requires a token, which is generated and printed as part of the URL.
"""
import html
import io
import re
import secrets
from contextlib import redirect_stderr, redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>LifeOS</title>
<style>
:root{{--bg:#fafaf7;--fg:#1d1d1b;--muted:#6b6b66;--card:#fff;--line:#e6e4dd;--accent:#2f6f4f}}
@media (prefers-color-scheme:dark){{:root{{--bg:#151614;--fg:#ecebe6;--muted:#9a9a93;--card:#1e1f1c;--line:#30312d;--accent:#7cc4a0}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 system-ui,sans-serif}}
main{{max-width:640px;margin:0 auto;padding:16px}}h1{{font-size:20px;margin:4px 0 12px}}
form.cap{{display:flex;gap:8px}}input[type=text]{{flex:1;min-width:0;padding:12px;font-size:16px;border:1px solid var(--line);
border-radius:10px;background:var(--card);color:var(--fg)}}button{{padding:10px 14px;border:0;border-radius:10px;
background:var(--accent);color:var(--bg);font-weight:600;font-size:15px}}
nav{{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}}nav button{{background:var(--card);color:var(--fg);border:1px solid var(--line)}}
.out{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 12px}}
.row{{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);white-space:pre-wrap}}
.row:last-child{{border-bottom:0}}.row span{{flex:1;min-width:0;overflow-wrap:anywhere}}.row button{{padding:4px 10px;font-size:13px}}
.hint{{color:var(--muted);font-size:13px;margin-top:10px}}
</style></head><body><main>
<h1>🐾 LifeOS</h1>
<form class="cap" method="post"><input type="hidden" name="t" value="{token}">
<input type="text" name="q" autofocus autocomplete="off" placeholder="kal vet 5pm · passport expires 2027-03-14 · kab hai?">
<button>Go</button></form>
<nav>{nav}</nav>
<div class="out">{out}</div>
<p class="hint">Anything you type is captured. End with “?” to ask. Commands: today, dog, review, list, search …, done N, edit N …, undo.</p>
</main></body></html>"""
NAV = ["today", "dog", "review", "list", "undo"]
ROW_ID = re.compile(r"^\[( |✔)\]\s+(\d+)\s")


def run_cli(text, store, today=None):
    from .cli import main  # local import: cli imports web for `serve`
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        try:
            main(text.split() or ["today"], store=store, today=today)
        except SystemExit:  # argparse error/--help
            pass
    return buf.getvalue()


def render(output, token):
    def row(line):
        m = ROW_ID.match(line)
        btn = ""
        if m and m[1] == " ":
            btn = (f'<form method="post"><input type="hidden" name="t" value="{token}">'
                   f'<input type="hidden" name="q" value="done {m[2]}"><button>✔</button></form>')
        return f'<div class="row"><span>{html.escape(line)}</span>{btn}</div>'
    nav = "".join(f'<form method="post"><input type="hidden" name="t" value="{token}">'
                  f'<input type="hidden" name="q" value="{c}"><button>{c}</button></form>' for c in NAV)
    out = "".join(row(l) for l in output.splitlines() if l.strip()) or row("…")
    return PAGE.format(token=html.escape(token), nav=nav, out=out)


def make_handler(store, token="", today=None):
    class Handler(BaseHTTPRequestHandler):
        def _authed(self, given):
            return not token or secrets.compare_digest(given or "", token)

        def _send(self, code, body):
            data = body.encode()
            self.send_response(code)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            qs = parse_qs(urlparse(self.path).query)
            if urlparse(self.path).path != "/":
                return self._send(404, "not found")
            if not self._authed(qs.get("t", [""])[0]):
                return self._send(403, "forbidden: add ?t=&lt;token&gt;")
            self._send(200, render(run_cli("today", store, today), token))

        def do_POST(self):
            n = min(int(self.headers.get("Content-Length") or 0), 10_000)
            form = parse_qs(self.rfile.read(n).decode("utf-8", "replace"))
            if not self._authed(form.get("t", [""])[0]):
                return self._send(403, "forbidden")
            self._send(200, render(run_cli(form.get("q", [""])[0], store, today), token))

        def log_message(self, *args):  # keep journal contents out of terminal logs
            pass

    return Handler


def serve(store, host="127.0.0.1", port=8765):
    token = "" if host in ("127.0.0.1", "localhost") else secrets.token_urlsafe(16)
    httpd = ThreadingHTTPServer((host, port), make_handler(store, token))
    shown = "<this-machine-ip>" if host == "0.0.0.0" else host
    print(f"LifeOS on http://{shown}:{httpd.server_port}/" + (f"?t={token}" if token else ""))
    if token:
        print("Open that URL on your phone (same Wi-Fi). Keep the token private. Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0
