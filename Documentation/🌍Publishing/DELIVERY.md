# Delivery — Crawler.Like.Audio

## Where it lands

| Target | What | How |
|---|---|---|
| **<https://crawler.like.audio>** | `Thin/out/` (Next.js static export) | `.github/workflows/ftp-publish.yml`: on every push to `main`, Node 20, `npm ci`, `npm test` in `Thin/`, the Thick unittest, `npm run build` in `Thin/`, then FTP-Deploy-Action to `crawler.like.audio` (user `crawler@like.audio`, password from the `FTP_PASSWORD` secret) |
| **apk.audio / WEB.Frontend-Assets image** | the repo's sources, as part of the `PODS/POD.THIN/Softapps` tree | root `ci.yml` deploy and `WEB.Frontend-Assets/Docker/Dockerfile` `COPY ["PODS/POD.THIN/Softapps", …]` |
| **Desktop** | Thick, run from the checkout | `Thick/run_crawler.sh` / `.bat`; `Thick/Crawler.desktop` is a launcher entry |

A push to `main` is a release of crawler.like.audio.

## Build and test

- Thin: `cd Thin && npm ci && npm run build` (passes as of 2026-10-30; prerenders `/` with
  every sidebar entry). `npm run lint` runs ESLint.
- Thin tests: `cd Thin && npm test`. Thick tests: `cd Thick && python3 -m unittest discover -s tests`.
- Thick: no build; `pip install -r Thick/requirements.txt`.
- Smoke result: [SMOKE.md](../🧩Manual%20and%20Artifacts/SMOKE.md).

## Not automated

- **The tests are small.** `Thin` has one guard (`test/base-path.test.mjs`: no hand-written
  root-absolute URL into `public/`), `Thick` covers the `.gitignore` matcher and where its
  state lives. Neither drives a window. There is no lint step in CI.
- **The apk.audio window's export is built by the APK.audio root CI**, not by this
  workflow: root `ci.yml` *Build the Crawler* runs `npm ci && npm run build` with
  `CRAWLER_BASE_PATH` set to the folder the window opens, so the `/_next/` chunks and the
  tree-sitter files resolve under `/APK:Softapps/…/Thin/out/`. A local build for the bench
  window needs the same variable; without it the export only works from a site root.
- **Thick is not packaged**; `installation.py` installs the requirements into the current
  Python.
