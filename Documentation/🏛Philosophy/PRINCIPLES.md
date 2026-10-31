# Principles — Crawler.Like.Audio

What this code holds to, and where it holds it. Ecosystem rules are in the APK.audio root
`Documentation/🏛Philosophy/` (for instance `Doctrine/readme.Artifacts are local markdown.md`);
cited, not copied.

## 1. No backend

Thin is a static export (`Thin/next.config.ts`, `output: "export"`); every engine in
`Thin/src/lib/` runs in the browser. The README's *Contributing* rule follows from it: new
audits are browser techniques (the timing-based LAN sweep in `NetworkScannerView.tsx`) or an
optional local relay, never a server of ours.

## 2. A project is one text file, and back

The crawl writes everything into `EVERYTHING.LOG` plus a `MAP.txt` tree, and the Regenerator
rebuilds the folder from that file. The corpus is the artefact, so it is versioned
(`# crawler-corpus: 1` on its first line) and written down once, in `Contract/corpus.v1.json`
with golden fixtures; `Thin/src/lib/corpusFormat.ts` and `Thick/crawler/corpus_format.py`
implement it and both test suites hold them to the same bytes. A reader refuses a version it
does not know.

## 2a. Two halves, one contract

Thin and Thick are both kept; they share rules, not code. Anything a later stage or the
other half reads — the corpus, which folders are skipped, which files are text, categories,
`.gitignore` answers, AST metrics — lives in `Contract/` and is tested in both languages
(ARCHITECTURE.md, *One domain, two halves*). A rule changed in one half alone fails CI.

## 3. Look before reading

The File Crawler pre-scans extensions and sizes and lets the user choose what goes into the
deep crawl before any file content is read (`CrawlerView.tsx` / `FileTypeSelector.tsx`;
Thick's File Types tab).

## 4. Offline by pinning

Thick pins `pymupdf4llm` to 0.3.4 because 1.x pulls in ML layout models
(`Thick/requirements.txt`); `run_crawler.sh` runs the system Python and clears `VIRTUAL_ENV`
so an editor's environment cannot change what runs.

## 5. Machine state stays out of the repo

Thick's recent folders and process log live in the user's config directory
(`Thick/crawler/config_manager.py` `default_config_path`), Thin's in `localStorage`
(`useAppStore.ts` `persist`, `partialize` to three fields). Crawl output lands in
`<target>/.crawler/`, which the crawler itself skips. A crawl only reads the target
(Thick used to delete its `__pycache__` folders; since 2026-10-30 it skips them).

## 6. Nobody in the middle

What leaves the browser goes where the user pointed it, not through a third party: the Web
Scraper fetches the page itself (`Thin/src/lib/fetcher.ts`, the only place Thin reaches a web
page), and the pdf.js worker and tree-sitter files are served from `Thin/public/`.
`Thin/test/boundaries.test.mjs` fails on a CORS-proxy host in code or a CDN worker.

## Where the code breaks these

- **The Audio Converter loads `lamejs` from cdnjs** (`AudioConverterView.tsx`), named in the
  README; it fetches code once and never sends audio.
- **Thick's Google Drive default is a hard-coded folder URL** (`config_manager.py`
  `get_drive_url`).
