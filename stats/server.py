"""NEXORA Mission Control - private localhost stats dashboard.

Runs ONLY on your own PC (http://localhost:8099). Shows real, honest numbers:
  * Download counts per release/asset  (public GitHub API, no login needed)
  * Stars / forks / watchers           (public GitHub API)
  * Repo page views + clones, 14 days  (needs YOUR login - read via your
    local `gh` CLI, never leaves this machine except to api.github.com)

What it can NOT show: live "users right now". The browser phones home to
nobody (see the privacy page), and GitHub download counts + update-check
traffic are anonymous. A live-user counter would require opt-in telemetry
built into the browser - say the word and we'll design that honestly.

Stdlib only. No dependencies. Nothing is uploaded anywhere.
"""
import json
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

OWNER_REPO = "khanhishan70-stack/NEXORA-Browser"
PORT = 8099
CACHE_TTL = 600  # seconds (also kind to the 60/hr anonymous API budget)
CACHE = {"at": 0, "data": None}
LOCK = threading.Lock()


def gh_api(path):
    """Public GitHub REST, no login."""
    try:
        req = urllib.request.Request(
            "https://api.github.com" + path,
            headers={"User-Agent": "NEXORA-Stats", "Accept": "application/vnd.github+json"},
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return {"_error": str(e)[:200]}


def gh_cli(path):
    """Authenticated call through YOUR local `gh` login (for traffic stats)."""
    try:
        out = subprocess.run(["gh", "api", path], capture_output=True, text=True, timeout=25)
        if out.returncode != 0:
            return {"_error": (out.stderr or "gh failed")[:200]}
        return json.loads(out.stdout)
    except Exception as e:
        return {"_error": str(e)[:200]}


def build_stats():
    releases_raw = gh_api("/repos/" + OWNER_REPO + "/releases?per_page=20")
    repo_raw = gh_api("/repos/" + OWNER_REPO)
    views_raw = gh_cli("repos/" + OWNER_REPO + "/traffic/views")
    clones_raw = gh_cli("repos/" + OWNER_REPO + "/traffic/clones")

    releases = []
    total_dl = 0
    if isinstance(releases_raw, list):
        for rel in releases_raw:
            assets = []
            rel_dl = 0
            for a in rel.get("assets", []) or []:
                n = int(a.get("download_count") or 0)
                rel_dl += n
                assets.append({
                    "name": a.get("name"),
                    "downloads": n,
                    "size": a.get("size"),
                    "updated": a.get("updated_at"),
                })
            total_dl += rel_dl
            releases.append({
                "tag": rel.get("tag_name"),
                "name": rel.get("name"),
                "published": (rel.get("published_at") or "")[:10],
                "downloads": rel_dl,
                "assets": assets,
            })

    def traffic(raw):
        if not isinstance(raw, dict) or "_error" in raw:
            return {"ok": False, "error": (raw or {}).get("_error", "unavailable")}
        return {"ok": True, "count": raw.get("count"), "uniques": raw.get("uniques")}

    return {
        "repo": OWNER_REPO,
        "total_downloads": total_dl,
        "stars": (repo_raw or {}).get("stargazers_count"),
        "forks": (repo_raw or {}).get("forks_count"),
        "watchers": (repo_raw or {}).get("subscribers_count"),
        "views_14d": traffic(views_raw),
        "clones_14d": traffic(clones_raw),
        "releases": releases,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "note": "Downloads/stars are public. Views/clones need your gh login on this PC. No live-user counter exists by design (no tracking in NEXORA).",
    }


def get_stats():
    with LOCK:
        if CACHE["data"] and time.time() - CACHE["at"] < CACHE_TTL:
            return CACHE["data"]
    data = build_stats()
    with LOCK:
        CACHE["data"] = data
        CACHE["at"] = time.time()
    return data


INDEX = None


def load_index():
    global INDEX
    try:
        import os
        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, "index.html"), "rb") as f:
            INDEX = f.read()
    except Exception:
        INDEX = b"<h1>index.html missing next to server.py</h1>"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(200, INDEX, "text/html; charset=utf-8")
        elif self.path == "/api/stats":
            try:
                self._send(200, json.dumps(get_stats()), "application/json")
            except Exception as e:
                self._send(500, json.dumps({"error": str(e)[:200]}), "application/json")
        elif self.path == "/api/refresh":
            with LOCK:
                CACHE["at"] = 0
            self._send(200, json.dumps(get_stats()), "application/json")
        else:
            self._send(404, "not found", "text/plain")


if __name__ == "__main__":
    load_index()
    srv = HTTPServer(("127.0.0.1", PORT), Handler)
    print("NEXORA Mission Control: http://localhost:%d  (private, this PC only)" % PORT)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
