import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import urlopen

STATIC = Path(__file__).resolve().parent / "static"
BOOKS = json.loads((STATIC / "books.json").read_text())
ENGLISH_API = "https://api.lsm.org/recver/txo.php"
ENGLISH_EDITION = "d2ViXzBkMWU1NDZhLWI4ZTQtNGEwNy04NDk5LTgzYWFkY2MwZmE2Yw=="
CHINESE_API = "https://www.recoveryversion.com.tw/api/getVerses"
ASSETS = {
    "/": ("index.html", "text/html"),
    "/app.js": ("app.js", "text/javascript"),
    "/style.css": ("style.css", "text/css"),
    "/books.json": ("books.json", "application/json"),
}


def fetch_json(endpoint, params):
    with urlopen(endpoint + "?" + urlencode(params), timeout=15) as response:
        return json.load(response)


def english_verses(keys):
    refs = "; ".join(f"{BOOKS[book - 1]} {chapter}:{verse}" for book, chapter, verse in keys)
    data = fetch_json(ENGLISH_API, {"file": ENGLISH_EDITION, "String": refs, "Out": "json", "Lang": "eng"})
    verses = {}
    for row in data["verses"]:
        match = re.fullmatch(r"(\d+)_.*?_(\d+)\.htm#[^-]+-(\d+)", row["urlpfx"])
        if match:
            verses[tuple(map(int, match.groups()))] = row["text"]
    return verses


def chinese_verses(keys):
    refs = ",".join(".".join(map(str, key)) for key in keys)
    data = fetch_json(CHINESE_API, {"VERSION": 2, "refs": refs})
    return {
        (int(row["chapter_code"]), int(row["section_code"]), int(row["segment_code"])): row["content"]
        for row in data
    }


def parse_keys(query):
    ids = parse_qs(query).get("ids", [""])[0].split(",")
    if len(ids) > 100 or any(not re.fullmatch(r"[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}", item) for item in ids):
        raise ValueError
    keys = [tuple(map(int, item.split("."))) for item in ids]
    if any(not (1 <= book <= len(BOOKS) and 1 <= chapter <= 150 and 1 <= verse <= 176)
           for book, chapter, verse in keys):
        raise ValueError
    return keys


def lookup(keys):
    with ThreadPoolExecutor(max_workers=2) as workers:
        english = workers.submit(english_verses, keys)
        chinese = workers.submit(chinese_verses, keys)
        english, chinese = english.result(), chinese.result()
    return [{"chinese": chinese.get(key), "english": english.get(key)} for key in keys]


class App(BaseHTTPRequestHandler):
    def reply(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def reply_json(self, status, payload):
        self.reply(status, "application/json", json.dumps(payload, ensure_ascii=False).encode())

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path in ASSETS:
            filename, content_type = ASSETS[url.path]
            self.reply(200, content_type, (STATIC / filename).read_bytes())
            return
        if url.path != "/api/verses":
            self.reply_json(404, {"error": "Page not found."})
            return
        try:
            keys = parse_keys(url.query)
        except ValueError:
            self.reply_json(400, {"error": "无效的经文出处。 / Invalid verse references."})
            return
        try:
            verses = lookup(keys)
        except (OSError, ValueError, KeyError, TypeError):
            self.reply_json(502, {"error": "暂时无法读取出版社经文。 / Publisher lookup failed. Please try again."})
            return
        self.reply_json(200, {"verses": verses})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the local bilingual Recovery Version verse finder.")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), App) as server:
        print(f"Open http://127.0.0.1:{args.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
