# Known Issues & Task Tracking — Crawler.Like.Audio

## 🔍 Active Issues & Edge Cases
Tracked: preventing infinite loops on broken circular symlinks; handling rate limits on remote HTTP file endpoints.

## Fixed 2026-10-30
- Thick's state (recent folders, process log) moved from the tracked `Thick/src/config.ini`
  to `~/.config/crawler-like-audio/config.ini` (`CRAWLER_CONFIG` overrides; a legacy file is
  read once as a seed). The file is untracked and ignored.
- `JsonConverterView` and `JsonPrettyPrintView` have sidebar entries under *Data Conversion*.
- `display.json` names the real `Thin/out/index.html` and no longer calls the folder a facade.
- The apk.audio window 404'd: root CI never built `Thin/out/`, and a built export asked for
  `/_next/…` and `/web-tree-sitter.js` at the site root. Root CI now builds it with
  `CRAWLER_BASE_PATH`; the tree-sitter URLs read `BASE_PATH`. `ftp-publish.yml` uses `npm ci`
  and runs the first tests of both halves.
- Thick's `.gitignore` matcher ignored nothing under an anchored pattern (`/build` did not
  skip `build/x.o`); it now tries each leading prefix, as git does.
- Thin's Web Scraper no longer goes through the public `api.allorigins.win` proxy; it
  fetches directly (`Thin/src/lib/fetcher.ts`). The pdf.js worker is served from `Thin/public/`.
- Thin's AST pass never ran: `public/tree-sitter-python.wasm` (tree-sitter-wasms 0.1.13) had
  the old `dylink` section web-tree-sitter 0.26 refuses ("need dylink section"). Replaced by
  tree-sitter-python 0.25.0's own WASM; `npm test` now parses with it.
- Thick's `.gitignore` matcher let `*` cross folders and matched `docs/*.md` anywhere; it now
  follows git's rules, checked against the same cases as Thin's `ignore` package
  (`Contract/fixtures/v1/ignore-cases.json`).
- Thick's crawl deleted every `__pycache__` it met in the target; it now only skips them.
- Thick's saver prepended MAP.txt to EVERYTHING.py.LOG while both were still open for
  writing; the corpus is now built whole and written once (`EVERYTHING.LOG`).
