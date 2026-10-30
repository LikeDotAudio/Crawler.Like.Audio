# Architecture — Crawler.Like.Audio

Two applications in one repository that do the same job — crawl a folder into one text
corpus, and regenerate a folder from one — with converters around it. The page-by-page
feature list is the repo [README](../../README.md); this page is the map.

## Using it

| Half | Run | Build |
|---|---|---|
| **Thin** (browser) | `cd Thin && npm install && npm run dev` → <http://localhost:3000> | `npm run build` → static export in `Thin/out/` |
| **Thick** (desktop) | `Thick/run_crawler.sh` (Linux/macOS), `run_crawler.bat` (Windows), or `python3 Thick/main.py` | `pip install -r Thick/requirements.txt` (or `Thick/installation.py`) |

In the APK.audio OS the window opens `Thin/out/index.html` (`display.json` `app`), which
exists only after a build, and only works from that deep folder when built with
`CRAWLER_BASE_PATH` set to it (`next.config.ts` → `basePath`; hand-written URLs into `public/`
read the same value through `src/lib/basePath.ts`).

## Thin — Next.js static export

```
Thin/src/app/page.tsx              the one page: <Sidebar/> + the view for activeTab
Thin/src/components/layout/Sidebar.tsx   five groups of tabs (17 views)
Thin/src/components/views/*View.tsx      one file per view
Thin/src/lib/*Engine.ts            the work behind each view (crawler, audit, scope map,
                                   regenerator, converters, hardware auditor, AST parser)
Thin/src/store/useAppStore.ts      Zustand store; persists activeTab, selectedFolder,
                                   recentFolders to localStorage ('crawler-storage')
Thin/public/*.wasm, web-tree-sitter.js   tree-sitter grammars for AST parsing
Thin/next.config.ts                output: "export"; canvas aliased away
```

Flow: the File Crawler (`crawlerEngine.ts`) reads a folder through the File System Access
API, pre-scans extensions for the selection pie, then builds `EVERYTHING.LOG` and `MAP.txt`
in memory, with AST metrics from `astParser.ts`. Visual Explorer, Program Map, SCOPE Map,
Project Audit and Extractor read that crawl from the store. The Regenerator parses an
`EVERYTHING.LOG` and writes the files back into a folder the user picks. No server is
involved; the two network touches are the Web Scraper's `api.allorigins.win` CORS proxy
(`WebCrawlerView.tsx`) and the Audio Converter's one-time `lamejs` fetch from cdnjs
(`AudioConverterView.tsx`).

## Thick — Python 3 + Tkinter

```
Thick/main.py                      opens FolderCrawlerApp on a Tk root
Thick/src/gui_module.py            the notebook and its twelve tabs (Thick/src/tabs/)
Thick/src/crawler_module.py        walks the folder (skips .crawler/), feeds the saver
Thick/src/saver_module.py          writes Crawl.log, MAP.txt, EVERYTHING.py.LOG into the run's
                                   output folder (<target>/.crawler/<name>-<timestamp>/)
Thick/src/regenerator_module.py, extractor_module.py, zipper_module.py, file_processor_module.py
Thick/src/config_manager.py        state: ~/.config/crawler-like-audio/config.ini
                                   (CRAWLER_CONFIG overrides; XDG_CONFIG_HOME honoured)
Thick/Audit/                       research notes (Apple TV, Chromecast, DNS, SNMP, browser APIs)
```

Thick's tabs: Select Folder, File Types, View Logs, Visual Explorer, Regenerate, USB Devices,
Web Crawler, PDF to MD (PyMuPDF / pymupdf4llm 0.3.4, offline), CSV to JSON, JSON to CSV,
JSON Format, Pretty Print.

## What it does not do

There is no MQTT and no bus topic: neither half imports a broker client (the old notes
claimed a `APK.audio/Gui/Display/Crawler` publisher; nothing in the code publishes it).
`display.json`'s `topic` is only the OS window's name.
