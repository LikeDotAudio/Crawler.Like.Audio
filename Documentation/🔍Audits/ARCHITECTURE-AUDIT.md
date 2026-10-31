# 🔍 Architecture audit — Crawler.Like.Audio (2026-10-30)

Audited against the APK.audio multi-repo architecture standard: coupling, boundaries, duplication, contracts.
← [Audits](INDEX.md) · Improvements: [🛣Roadmap/IMPROVEMENTS.md](../%F0%9F%9B%A3Roadmap/IMPROVEMENTS.md)

## Bounded context
Intake stage of the Scanalyzer pipeline: crawl a local folder into a corpus (`EVERYTHING.LOG`, `MAP.txt`, AST metrics) plus a bag of format converters (PDF→MD, CSV/JSON/YAML/XLSX, audio). Two halves in one repo: `Thin/` Next.js 16 static export (TypeScript, ~2.6 k lines in `src/lib` + views) and `Thick/` Python 3/Tkinter desktop app. Nested submodule of SCANALYZER.Like.audio. Sampled: `README.md`, `display.json`, `Thin/package.json`, `Thin/src/lib/*Engine.ts`, `Thin/src/components/views/WebCrawlerView.tsx`, `PdfToMdView.tsx`, `Thick/main.py`, `Thick/requirements.txt`, `Thick/tests/test_core.py`, `Thin/test/base-path.test.mjs`, `.github/workflows/ftp-publish.yml`, KNOWN_ISSUES.

## Context map
| Talks to | How (topic / endpoint / file / import) | Relationship |
|---|---|---|
| SCANALYZER.Like.audio (parent) | submodule; `display.json` declares stage `01 · Event`, overriding `pipeline.json` | Customer–Supplier (parent pipeline consumes the corpus) |
| Softapp launcher | `display.json` `app: …/Thin/out/index.html` (build artefact, kept by design — ARCHITECTURE.md *Using it*); no `topic` | Published Language (manifest) |
| Root CI | builds `Thin/out/` with `CRAWLER_BASE_PATH` (per KNOWN_ISSUES) | Build-time coupling |
| The page the user names | `Thin/src/lib/fetcher.ts` direct CORS fetch (Web Scraper) | Open Host (theirs) |
| CAPTURE.WebScraper | Thick Web Crawler tab imports `apk_webscraper` (pip package; inert without it) | Customer–Supplier |
| SCANALYZER stages, both Regenerators | `Contract/corpus.v1.json` + `fixtures/v1/` (`# crawler-corpus: 1`) | Published Language |
| crawler.like.audio | FTPS from `ftp-publish.yml` | Delivery |

No MQTT; no file references into sibling repos (Thick/installation.py names the CAPTURE.WebScraper checkout only as a pip source, with its repository as the fallback).

## Scorecard
| Category | Score (0–3) | Finding |
|---|---|---|
| Coupling & Cohesion | 3 | No cross-repo file reach; Thick is a package (`python -m crawler`); the launcher's build-artefact entry is the documented root-CI convention. |
| Boundary Integrity | 3 | Web fetch behind `src/lib/fetcher.ts` (no third-party proxy); pdf.js worker and tree-sitter self-hosted in `Thin/public/`; a test guards both. |
| Duplication Control | 3 | Two halves kept by decision, sharing rules (skip, text, categories, `.gitignore`, AST metrics, corpus) through `Contract/`; the web crawl is CAPTURE.WebScraper's. |
| Testing & Contracts | 3 | Golden corpus fixtures run in both languages in CI, plus fetcher, boundary, base-path and state tests. |
| Change management | 3 | Corpus carries `# crawler-corpus: 1`; readers refuse an unknown version; the change rule is written in ARCHITECTURE.md. |
Score key: 3 meets the standard · 2 minor gaps · 1 significant gaps · 0 absent / violated.

## Findings
1. **Good — engines separated from views.** `Thin/src/lib/` holds `crawlerEngine.ts`, `csvToJsonEngine.ts`, `hardwareAuditorEngine.ts` (read-only WebUSB, careful error split), `audits/*`; this is the right adapter shape.
2. **Good — pinned Python deps and `npm ci`.** `Thick/requirements.txt` pins every package (with a reasoned pin on `pymupdf4llm` 0.3.4); `ftp-publish.yml` uses `npm ci`, lint, both test suites, then build.
3. **Smoke page present** — [SMOKE.md](../%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md).

Every other finding of this audit was delivered or kept by design — see [🌍Publishing/DELIVERY.md](../%F0%9F%8C%8DPublishing/DELIVERY.md) (*Delivered from the 2026-10-30 audit*).
