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

The crawl writes everything into `EVERYTHING.LOG` plus a `MAP.txt` tree
(`Thin/src/lib/crawlerEngine.ts`; Thick `saver_module.py`, which prepends the map with
`prepend_map_to_everything`), and the Regenerator rebuilds the folder from that file
(`regeneratorEngine.ts`, `Thick/src/regenerator_module.py`). The corpus is the artefact.

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
(`Thick/src/config_manager.py` `default_config_path`), Thin's in `localStorage`
(`useAppStore.ts` `persist`, `partialize` to three fields). Crawl output lands in
`<target>/.crawler/`, which the crawler itself skips.

## Where the code breaks these

- **Two pages leave the browser.** The Web Scraper sends every URL through the public
  `api.allorigins.win` proxy (`WebCrawlerView.tsx`), and the Audio Converter loads `lamejs`
  from cdnjs (`AudioConverterView.tsx`). Both are named in the README; the first means a third
  party sees what is scraped.
- **Thick's Google Drive default is a hard-coded folder URL** (`config_manager.py`
  `get_drive_url`).
