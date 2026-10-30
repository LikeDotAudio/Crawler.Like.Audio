# Known Issues & Task Tracking — Crawler.Like.Audio

## 🔍 Active Issues & Edge Cases
Tracked: preventing infinite loops on broken circular symlinks; handling rate limits on remote HTTP file endpoints.

## Found while refreshing the README (2026-10-30)
- **Thin's Web Scraper fetches through `api.allorigins.win`**, a public third-party CORS
  proxy, so the "nothing leaves the browser" promise does not hold for that page (the
  README now says so).

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
