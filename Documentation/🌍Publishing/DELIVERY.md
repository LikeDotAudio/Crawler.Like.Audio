# Delivery — Crawler.Like.Audio

## Where it lands

| Target | What | How |
|---|---|---|
| **<https://crawler.like.audio>** | `Thin/out/` (Next.js static export) | `.github/workflows/ftp-publish.yml`: on every push to `main`, Node 24, `npm ci`, lint and `npm test` in `Thin/`, the Thick unittest, `npm run build` in `Thin/`, then FTP-Deploy-Action to `crawler.like.audio` (user `crawler@like.audio`, password from the `FTP_PASSWORD` secret) |
| **apk.audio / WEB.Frontend-Assets image** | the repo's sources, as part of the `PODS/POD.THIN/Softapps` tree | root `ci.yml` deploy and `WEB.Frontend-Assets/Docker/Dockerfile` `COPY ["PODS/POD.THIN/Softapps", …]` |
| **Desktop** | Thick, run from the checkout | `Thick/run_crawler.sh` / `.bat` (`python3 -m crawler`); `Thick/Crawler.desktop` is a launcher entry |

A push to `main` is a release of crawler.like.audio.

## Build and test

- Thin: `cd Thin && npm ci && npm run build` (passes as of 2026-10-30; prerenders `/` with
  every sidebar entry). `npm run lint` runs ESLint: 0 errors as of 2026-10-30 (warnings
  only), and CI runs it before the tests, so a new error blocks the deploy.
- Thin tests: `cd Thin && npm test` (Node ≥ 22.18: it loads `src/lib/*.ts` by type
  stripping). Thick tests: `cd Thick && python3 -m unittest discover -s tests`. Both run the
  corpus contract in `Contract/fixtures/v1/`.
- Type check: `cd Thin && npx tsc --noEmit`.
- Thick: no build; `pip install -r Thick/requirements.txt`.
- Smoke result: [SMOKE.md](../🧩Manual%20and%20Artifacts/SMOKE.md).

## Not automated

- **No test drives a window.** The suites cover the logic under the views: the corpus
  contract (golden MAP.txt / EVERYTHING.LOG / AST metrics, the reader and its version
  refusal, `.gitignore` and name rules) in both halves, the fetcher and the no-third-party
  boundary in Thin, the base path, and Thick's state location.
- **The apk.audio window's export is built by the APK.audio root CI**, not by this
  workflow: root `ci.yml` *Build the Crawler* runs `npm ci && npm run build` with
  `CRAWLER_BASE_PATH` set to the folder the window opens, so the `/_next/` chunks and the
  tree-sitter files resolve under `/APK:Softapps/…/Thin/out/`. A local build for the bench
  window needs the same variable; without it the export only works from a site root.
- **Thick is a package but not published**: `python3 -m crawler` from `Thick/`;
  `installation.py` installs the requirements and CAPTURE.WebScraper into the user's Python.

## Delivered from the 2026-10-30 audit

- **Versioned corpus spec with golden fixtures, tested by both halves** — `Contract/corpus.v1.json` + `Contract/fixtures/v1/` (input tree, expected `MAP.txt` / `EVERYTHING.LOG` / `ast-metrics.json`, parse, ignore and name cases); implemented in `Thin/src/lib/corpusFormat.ts` and `Thick/crawler/corpus_format.py`, spec prose in ARCHITECTURE.md *Corpus format*. Both crawlers now emit byte-identical output for the fixture folder. Verified: `npm test` (`test/corpus-contract.test.mjs`, real tree-sitter parse) and `python3 -m unittest discover -s tests` (`test_corpus_contract.py`), both wired into `ftp-publish.yml`.
- **Corpus format version** — first line `# crawler-corpus: 1` on MAP.txt and EVERYTHING.LOG; both Regenerators read v1 and the unversioned legacy logs of both halves, refuse a newer version (`future-v2.LOG` fixture) and drop paths that would leave the target. Thick's output file is now `EVERYTHING.LOG` (was `EVERYTHING.py.LOG`; the Regenerate tab still opens old ones). Verified by the parse-case tests in both suites.
- **Fetcher adapter, no third-party proxy** — `Thin/src/lib/fetcher.ts` (direct credential-less CORS fetch, `CorsBlockedError` / `HttpStatusError`); `WebCrawlerView.tsx` uses it and `api.allorigins.win` is gone. Verified: `test/boundaries.test.mjs` (stubbed fetch, and no CORS-proxy host anywhere in `src/`).
- **Self-hosted pdf.js worker** — `Thin/public/pdf.worker.min.js` (pdfjs-dist 3.11.174, `npm run sync:pdf-worker`), `PdfToMdView.tsx` sets `workerSrc` to `${BASE_PATH}/pdf.worker.min.js`. Verified: boundaries test checks the worker's version against `node_modules/pdfjs-dist` and the view's `workerSrc`.
- **One owner per tool / shared rules** — decision recorded in ARCHITECTURE.md *One domain, two halves* and PRINCIPLES.md §2a: both halves kept, rules shared through `Contract/`. The skip rules, text extensions, category table (Thin's pre-scan and Thick's File Types tab) and default selection are one table; Thick's `.gitignore` matcher was rewritten to git's rules and both halves answer `ignore-cases.json` the same. Side fixes found by the shared fixtures: Thin's AST pass never ran (old-ABI `tree-sitter-python.wasm` replaced with tree-sitter-python 0.25.0's build), Thick's crawl deleted `__pycache__` in the target (now skips), and Thick's saver rewrote EVERYTHING while it was still open.
- **Thick packaged** — `Thick/src/` → `Thick/crawler/` with `__main__.py`; `python3 -m crawler` from `Thick/`, `main.py` is a shim without `sys.path.append`, `run_crawler.sh` / `.bat` use `-m crawler`; the old `Thick/src/config.ini` is still read once as a seed. Verified: tests import `crawler.*`; `python3 -c "import crawler.gui_module"`.
- **Thick Web Crawler uses the shared crawler** (handoff from S02-capture, for CAPTURE.WebScraper IMPROVEMENTS #5) — `Thick/crawler/tabs/WebCrawler/{downloader,parser}.py` (no robots.txt, no rate limit, spoofed UA, no provenance) deleted; `web_crawler_tab.py` calls `apk_webscraper.crawl(url, out=..., media=..., logger=..., on_file=...)` like CAPTURE.crawler's tab, and stays inert with an install hint when the package is absent; `installation.py` installs it from the monorepo checkout (else its repo). Verified: `test_no_second_scraper`; tab imported with and without `apk_webscraper` on the path.
- **WS-03 display.json declares a topic nothing publishes** — `"topic": "APK.audio/Gui/Softapps/Crawler"` dropped from `display.json` (no MQTT in either half); ARCHITECTURE.md updated. This is the OS softapp tile's manifest.
- **Launcher entry points at the untracked `Thin/out/index.html`** — Kept by design: the house convention for softapps built by root CI (`ci.yml` *Build the Crawler* with `CRAWLER_BASE_PATH`, before WEB.Frontend-Assets copies the Softapps tree); committing `out/` would duplicate every chunk in git. Reason written in ARCHITECTURE.md *Using it*.
- **Tested** — `cd Thin && npm test` (12 pass), `npx tsc --noEmit` (clean), `npm run lint` (0 errors); `cd Thick && python3 -m unittest discover -s tests` (18 pass). CI (`ftp-publish.yml`) moved to Node 24 so `npm test` can load the TypeScript modules.

## Delivered 2026-11-11 – 2026-11-12

From this repository's own commits (the commit message is the record):

- vendor: apk-contracts web bundle refreshed from contracts/generated/web (report.ts: LogLine + ProblemRecord, System/Problems family) (`bb08333`)
- vendor/apk-softapp: re-vendored — every problem card is reported through the SDK (ROAD-3695 step 2) (`65e58aa`)
- vendor: apk-contracts web bundle refreshed from contracts/generated/web (five report codes, ROAD-3695; unit-gate, ROAD-3684) (`cae2216`)
- re-vendor apk-contracts web bundle: contracts 2.4.0 retires APK.audio/Tests/{suite} (ROAD-3729) (`25d6306`)
- wiki: lanes, README and smoke result refreshed (wiki.py + smoke.py) (`4cb8e83`)
- docs(smoke): pass — results in the wiki (`c8d40f5`)
- lint: CommonJS test shims may require() and keep `this` (5 errors stopped the crawler.like.audio deploy — ROAD-3669) (`3cd807e`)
- roadmap page: the Development Goals line is root ROAD-3777; nothing to do is kept here (`77b8f3f`)
- vendor: apk-contracts re-vendored (contracts gained the youtube_audio problem codes, root f013ba68a) (`cdabd66`)
- Thick crawl: worker pool and content dedup (ROAD-3777) (`3176420`)
- vendor/apk-contracts: refresh to contracts/generated/web after ROAD-3759 (contracts split; CHAT_TOPIC origin note) (`d679234`)
- vendor: apk-softapp / apk-table re-joined from their parts (one GENERATED banner line; ROAD-3762) (`f256ae2`)

## Releases
- **Released `2.0.0`, tag `v2.0.0`** (2026-11-01, ROAD-3452, the owner's V2) — no SDK pin; every manifest says 2.0.0; GitHub release `v2.0.0`.
