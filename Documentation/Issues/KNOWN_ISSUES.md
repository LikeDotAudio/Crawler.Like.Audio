# Known Issues & Task Tracking — Crawler.Like.Audio

## 🔍 Active Issues & Edge Cases
Tracked: preventing infinite loops on broken circular symlinks; handling rate limits on remote HTTP file endpoints.

## Found while refreshing the README (2026-10-30)
- **`Thick/src/config.ini` is tracked and is also the app's runtime state.** It carries
  612 lines of one machine's recent folders and a timestamped activity log; every run of
  Thick dirties the repo.
- **Thin's Web Scraper fetches through `api.allorigins.win`**, a public third-party CORS
  proxy, so the "nothing leaves the browser" promise does not hold for that page (the
  README now says so).
- **`JsonConverterView` and `JsonPrettyPrintView` have no sidebar entry** — reachable in
  code, unreachable in the UI (Thick has both as tabs 11 and 12).
- **`display.json` still describes this folder as a facade of two symlinks** into
  `APK:audio:WebPortal/...`; `Thick/` and `Thin/` are real directories here now, and its
  `app` path names a location that no longer exists.
