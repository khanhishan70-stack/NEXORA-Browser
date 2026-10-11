# NEXORA Mission Control (private localhost dashboard)

```bat
stats.bat
```

Then open **http://localhost:8099** — runs only on your PC.

## What each number means (honest)

| Number | Source | Meaning |
|---|---|---|
| Total / per-release downloads | Public GitHub API | Real installer downloads. Cached 10 min. |
| Stars / forks | Public GitHub API | Real repo signals. |
| Views, visitors, clones (14d) | GitHub traffic API via YOUR `gh` login | Real, but only visible to repo owner. Needs `gh` authed on this PC. |
| Live "users right now" | — | **Does not exist.** NEXORA phones home to nobody, so nobody (including you) can count live users. Update-check hits on GitHub are anonymous. |

Want a live-user counter one day? That needs explicit opt-in telemetry in
the browser + a counting server, designed openly with the privacy page
updated first. Say the word.
