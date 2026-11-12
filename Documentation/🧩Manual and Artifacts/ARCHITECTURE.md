# Architecture — Crawler.Like.Audio

Two applications in one repository that do the same job — crawl a folder into one text
corpus, and regenerate a folder from one — with converters around it. The page-by-page
feature list is the repo [README](../../README.md); this page is the map.

## Using it

| Half | Run | Build |
|---|---|---|
| **Thin** (browser) | `cd Thin && npm install && npm run dev` → <http://localhost:3000> | `npm run build` → static export in `Thin/out/` |
| **Thick** (desktop) | `Thick/run_crawler.sh` (Linux/macOS), `run_crawler.bat` (Windows), or `cd Thick && python3 -m crawler` (`python3 main.py` still works) | `pip install -r Thick/requirements.txt` (or `Thick/installation.py`, which also installs CAPTURE.WebScraper) |

In the APK.audio OS the window opens `Thin/out/index.html` (`display.json` `app`), which
exists only after a build, and only works from that deep folder when built with
`CRAWLER_BASE_PATH` set to it (`next.config.ts` → `basePath`; hand-written URLs into `public/`
read the same value through `src/lib/basePath.ts`).

**Kept by design: the launcher points at a build artefact.** `Thin/out/` is untracked and
`display.json` names it anyway. That is the house convention for softapps that are built,
not served from source: the APK.audio root CI (`ci.yml`, *Build the Crawler*) builds the
export with `CRAWLER_BASE_PATH` before the WEB.Frontend-Assets image copies the Softapps tree,
and committing `out/` would put a second, stale copy of every chunk in git. A bench checkout
builds it once with the same variable (DELIVERY.md, *Not automated*).

## Thin — Next.js static export

```
Thin/src/app/page.tsx              the one page: <Sidebar/> + the view for activeTab
Thin/src/components/layout/Sidebar.tsx   five groups of tabs (17 views)
Thin/src/components/views/*View.tsx      one file per view
Thin/src/lib/*Engine.ts            the work behind each view (crawler, audit, scope map,
                                   regenerator, converters, hardware auditor, AST parser)
Thin/src/lib/corpusFormat.ts       the corpus contract v1 in code: MAP.txt / EVERYTHING.LOG
                                   writers and reader, skip/text/category rules, AST metrics
Thin/src/lib/fetcher.ts            the one way out to a web page (direct CORS fetch)
Thin/src/store/useAppStore.ts      Zustand store; persists activeTab, selectedFolder,
                                   recentFolders to localStorage ('crawler-storage')
Thin/public/*.wasm, web-tree-sitter.js   tree-sitter runtime + grammars for AST parsing
                                   (python: tree-sitter-python 0.25.0's own build)
Thin/public/pdf.worker.min.js      pdf.js worker, copied from node_modules (npm run sync:pdf-worker)
Thin/test/*.test.mjs               npm test: base path, boundaries, corpus contract
Thin/next.config.ts                output: "export"; canvas aliased away
```

Flow: the File Crawler (`crawlerEngine.ts`) reads a folder through the File System Access
API, pre-scans extensions for the selection pie, then builds `EVERYTHING.LOG` and `MAP.txt`
in memory, with AST metrics from `astParser.ts`. Visual Explorer, Program Map, SCOPE Map,
Project Audit and Extractor read that crawl from the store. The Regenerator parses an
`EVERYTHING.LOG` and writes the files back into a folder the user picks. No server is
involved; the two network touches are the Web Scraper's direct fetch of the page the user
names (`src/lib/fetcher.ts`, no proxy) and the Audio Converter's one-time `lamejs` fetch from
cdnjs (`AudioConverterView.tsx`).

## Thick — Python 3 + Tkinter

```
Thick/crawler/                     the package: `python3 -m crawler` from Thick/ (__main__.py);
                                   Thick/main.py is a two-line shim, no sys.path edits
Thick/crawler/gui_module.py        the notebook and its twelve tabs (Thick/crawler/tabs/)
Thick/crawler/corpus_format.py     the corpus contract v1 in code (Thin's corpusFormat.ts twin)
Thick/crawler/crawler_module.py    walks the folder with the shared rules, builds the corpus
Thick/crawler/saver_module.py      writes Crawl.log, MAP.txt, EVERYTHING.LOG into the run's
                                   output folder (<target>/.crawler/<name>-<timestamp>/)
Thick/crawler/regenerator_module.py, extractor_module.py, zipper_module.py
Thick/crawler/tabs/WebCrawler/     drives CAPTURE.WebScraper (`apk_webscraper.crawl`); inert
                                   with a message when that package is not installed
Thick/crawler/config_manager.py    state: ~/.config/crawler-like-audio/config.ini
                                   (CRAWLER_CONFIG overrides; XDG_CONFIG_HOME honoured)
Thick/Audit/                       research notes (Apple TV, Chromecast, DNS, SNMP, browser APIs)
```

Thick's tabs: Select Folder, File Types, View Logs, Visual Explorer, Regenerate, USB Devices,
Web Crawler, PDF to MD (PyMuPDF / pymupdf4llm 0.3.4, offline), CSV to JSON, JSON to CSV,
JSON Format, Pretty Print.

## What it does not do

There is no MQTT and no bus topic: neither half imports a broker client (the old notes
claimed a `APK.audio/Gui/Display/Crawler` publisher; nothing in the code publishes it).
`display.json` declares no `topic` since 2026-10-30: it named
`APK.audio/Gui/Softapps/Crawler`, which nothing published.

## Corpus format (crawler-corpus, version 1)

The corpus is what SCANALYZER's later stages and both Regenerators read, so it is a
contract: [`Contract/corpus.v1.json`](../../Contract/corpus.v1.json) holds the values,
`Contract/fixtures/v1/` the golden files, and both halves are tested against them
(`Thin/test/corpus-contract.test.mjs`, `Thick/tests/test_corpus_contract.py`) — a crawl of
`fixtures/v1/input/` must produce `expected/MAP.txt` and `expected/EVERYTHING.LOG` byte for
byte, in Python and in the browser.

- **Version line.** The first line of `MAP.txt`, and so of `EVERYTHING.LOG`, is
  `# crawler-corpus: 1`. A reader takes the number from it (a leading BOM is ignored);
  a file without it is version 0 (written before 2026-10-30) and is read with the old
  delimiters; a number above what the reader knows is **refused**
  (`UnsupportedCorpusVersionError` / `UnsupportedCorpusVersion`), never guessed at.
- **MAP.txt.** `# crawler-corpus: 1`, `# Program Map: <root>`, `# Created: <local time>`,
  `#`, `<root>/`, then a box-drawing tree (`├── `/`└── `, `│   ` indent): folders first, then
  files, each sorted by name. A Python file with metrics carries
  `  (classes: N, functions: M)`. `Created` is free text — do not parse it.
- **EVERYTHING.LOG.** The whole MAP.txt, a blank line, 84 `-`, a blank line, the
  `# EVERYTHING.LOG` banner (84 `=`, `# Log started at:`), then for each text file in map
  order a blank line, `# --- File: <path> ---` and its content. `<path>` is POSIX, relative to
  the crawled folder, without the root's name or a leading slash. Content keeps every byte
  except trailing newlines, which collapse to exactly one (an empty file stays empty) — the
  one place a round trip is not exact. A content line that is itself a delimiter line splits
  the file; readers drop paths with `..`, a drive or a leading `/`.
- **Duplicates (link lines).** Thick hashes every file (sha256, streamed). A non-empty file
  whose content matches an earlier file in map order is not copied again: between the banner
  and the first file section EVERYTHING.LOG carries `# --- Link: {"path", "sameAs",
  "sha256"} ---` (JSON, sorted keys), and the map labels it `  (same as: <path>)`. Every v1
  reader skips text before the first section, so this stayed version 1; Thick's Regenerator
  writes the copy back from the file it names. A folder without duplicates has no link lines.
- **Which files.** Folders named `node_modules`, `venv`, `__pycache__`, `crawl` (any case),
  any dot-folder and any 14-digit timestamp folder are skipped; the root `.gitignore` applies
  with git's rules (`fixtures/v1/ignore-cases.json`); the extension (`os.path.splitext`'s
  rule: `.gitignore` has none) must be selected. Only `textExtensions` files are copied into
  EVERYTHING.LOG; the rest appear in the map only.
- **AST metrics.** For `.py` files under 512 000 bytes: every class and function (methods,
  nested and `async def` included), depth-first in source order, as
  `{classCount, functionCount, structures: [{type, name}]}`
  (`fixtures/v1/expected/ast-metrics.json`). Thin gets them from tree-sitter, Thick from
  `ast`; a file Python cannot parse has none.
- **Changing it.** Bump `version`, add `Contract/fixtures/v<N>/`, keep reading the older
  versions, and change both halves in the same commit — the two test suites will not pass
  otherwise.

## One domain, two halves: who owns what

Thin and Thick both crawl, regenerate, convert CSV/JSON and PDF, and pick file types. The
2026-10-30 audit asked for one owner per tool or shared rules. **Decision: shared rules,
both halves kept** — the reversible choice, because Thick has reach the browser cannot have
(USB, PyMuPDF offline, real filesystem walks) and Thin is the deployed site. What is shared
is what downstream depends on: the corpus format, the skip/text/category rules, `.gitignore`
answers and AST metrics, all through `Contract/`. Converters that produce a file the user
reads (CSV↔JSON, PDF→MD) stay independent per half; if one of them grows consumers, it gets a
fixture in `Contract/` first. The web crawl has a single owner outside this repo:
CAPTURE.WebScraper (Thick's tab drives it; Thin's Web Scraper is a one-page converter, not a
crawler).
