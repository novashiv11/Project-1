"""`life` command line. Anything that isn't a subcommand is captured as a new item."""
import argparse
import sys
from datetime import date, timedelta

from .parse import parse
from .store import Store

ICONS = {"dog": "🐶", "document": "🛂", "package": "📦", "house": "🏠", "health": "💪",
         "money": "💰", "idea": "💡", "calendar": "📅", "journal": "📓"}
COMMANDS = {"add", "list", "today", "search", "done"}


def fmt(item):
    check = "✔" if item.get("done") else " "
    due = f"  ⏰ {item['due']}" if item.get("due") else ""
    track = f"  #{' #'.join(item['tracking'])}" if item.get("tracking") else ""
    return f"[{check}] {item['id']:>3} {ICONS.get(item['domain'], '•')} {item['text']}{due}{track}"


def show(items, empty="Nothing here."):
    print("\n".join(fmt(i) for i in items) if items else empty)


def main(argv=None, store=None, today=None):
    argv = sys.argv[1:] if argv is None else argv
    store = store or Store()
    today = today or date.today()
    if argv and argv[0] not in COMMANDS and not argv[0].startswith("-"):
        argv = ["add", *argv]

    ap = argparse.ArgumentParser(prog="life", description="LifeOS — throw your life at it.")
    sub = ap.add_subparsers(dest="cmd")
    sub.add_parser("add").add_argument("text", nargs="+")
    ls = sub.add_parser("list")
    ls.add_argument("--domain")
    ls.add_argument("--all", action="store_true", help="include done items")
    sub.add_parser("today")
    sub.add_parser("search").add_argument("query", nargs="+")
    sub.add_parser("done").add_argument("id", type=int)
    args = ap.parse_args(argv)

    if args.cmd == "add":
        item = store.add(parse(" ".join(args.text)))
        print("Saved " + fmt(item))
    elif args.cmd == "list":
        items = [i for i in store.items() if (args.all or not i["done"])
                 and (not args.domain or i["domain"] == args.domain)]
        show(items)
    elif args.cmd == "search":
        q = " ".join(args.query).lower()
        show([i for i in store.items() if q in i["text"].lower()], "No matches.")
    elif args.cmd == "done":
        print("Done ✔" if store.done(args.id) else f"No item {args.id}.")
    else:  # today (default)
        horizon = (today + timedelta(days=7)).isoformat()
        open_due = sorted((i for i in store.items() if i["due"] and not i["done"]), key=lambda i: i["due"])
        overdue = [i for i in open_due if i["due"][:10] < today.isoformat()]
        upcoming = [i for i in open_due if today.isoformat() <= i["due"][:10] <= horizon]
        if overdue:
            print("⚠️  Overdue")
            show(overdue)
        print(f"📆 Next 7 days (from {today})")
        show(upcoming, "Clear. Enjoy the day 🐾")
    return 0
