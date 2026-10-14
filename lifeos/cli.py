"""`life` command line. Anything that isn't a subcommand is captured as a new item."""
import argparse
import re
import sys
from datetime import date, datetime

from .ask import answer
from .ics import to_ics
from .parse import parse
from .store import Store
from .views import fmt, lines, today_view, dog_view, review_view

BARE = {"today", "dog", "review", "undo"}  # commands only when typed alone ("today I felt..." is a note)


def is_command(argv):
    if not argv:
        return True
    head, rest = argv[0], argv[1:]
    if head in BARE:
        return not rest
    if head == "list":
        return not rest or rest[0].startswith("-")
    if head == "done":
        return len(rest) == 1 and rest[0].isdigit()
    if head == "edit":
        return len(rest) >= 2 and rest[0].isdigit()
    if head == "export":
        return rest in ([], ["ics"])
    if head == "serve":
        return all(a.startswith("-") or a.isdigit() or "." in a or a == "localhost" for a in rest)
    if head == "ask":
        return bool(rest)
    return head in {"add", "search"} or head.startswith("-")


def is_question(argv):
    """`life when is the vet?` asks; `life idea: what if dogs talked?` still captures."""
    text = " ".join(argv).strip()
    return text.endswith("?") and not re.match(r"\w+\s*:", text)


def main(argv=None, store=None, today=None):
    argv = sys.argv[1:] if argv is None else argv
    store = store or Store()
    today = today or date.today()
    if not is_command(argv):
        argv = ["ask" if is_question(argv) else "add", *argv]

    ap = argparse.ArgumentParser(prog="life", description="LifeOS — throw your life at it.")
    sub = ap.add_subparsers(dest="cmd")
    sub.add_parser("add", help="capture anything").add_argument("text", nargs="+")
    ls = sub.add_parser("list", help="list open items")
    ls.add_argument("--domain")
    ls.add_argument("--all", action="store_true", help="include done items")
    sub.add_parser("today", help="overdue + coming up (default)")
    sub.add_parser("search").add_argument("query", nargs="+")
    sub.add_parser("done", help="complete an item (recurring ones roll forward)").add_argument("id", type=int)
    sub.add_parser("dog", help="dog dashboard")
    sub.add_parser("review", help="weekly review + journal prompt")
    sub.add_parser("ask", help="question over your journal (or just end with '?')").add_argument("q", nargs="+")
    ed = sub.add_parser("edit", help="replace an item's text (re-parsed)")
    ed.add_argument("id", type=int)
    ed.add_argument("text", nargs="+")
    sub.add_parser("undo", help="undo the last change")
    sv = sub.add_parser("serve", help="web UI; --host 0.0.0.0 to use from your phone")
    sv.add_argument("--host", default="127.0.0.1")
    sv.add_argument("--port", type=int, default=8765)
    sub.add_parser("export", help="export dated items: life export ics > life.ics").add_argument(
        "fmt", nargs="?", default="ics", choices=["ics"])
    args = ap.parse_args(argv)

    items = store.items
    if args.cmd == "add":
        out = ["Saved " + fmt(store.add(parse(" ".join(args.text), datetime.combine(today, datetime.now().time()))), today)]
    elif args.cmd == "list":
        out = lines([i for i in items() if (args.all or not i["done"])
                     and (not args.domain or i["domain"] == args.domain)], today=today)
    elif args.cmd == "search":
        q = " ".join(args.query).lower()
        out = lines([i for i in items() if q in i["text"].lower()], "No matches.")
    elif args.cmd == "done":
        item = store.done(args.id, today)
        out = [f"No item {args.id}." if not item
               else f"Done ✔ next: {item['due']}" if not item["done"] else "Done ✔"]
    elif args.cmd == "dog":
        out = dog_view(items(), today)
    elif args.cmd == "review":
        out = review_view(items(), today)
    elif args.cmd == "ask":
        out = answer(" ".join(args.q), items(), today)
    elif args.cmd == "edit":
        fields = parse(" ".join(args.text), datetime.combine(today, datetime.now().time()))
        item = store.edit(args.id, fields)
        out = [("Edited " + fmt(item, today)) if item else f"No item {args.id}."]
    elif args.cmd == "undo":
        what = store.undo()
        out = [f"↩️  Undid {what}" if what else "Nothing to undo."]
    elif args.cmd == "serve":
        from .web import serve
        return serve(store, args.host, args.port)
    elif args.cmd == "export":
        sys.stdout.write(to_ics(items()))
        return 0
    else:
        out = today_view(items(), today)
    print("\n".join(out))
    return 0
