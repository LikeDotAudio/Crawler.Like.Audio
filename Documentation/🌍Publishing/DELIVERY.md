# Delivery — Crawler.Like.Audio

## Where it lands

| Target | What | How |
|---|---|---|
| **<https://crawler.like.audio>** | `Thin/out/` (Next.js static export) | `.github/workflows/ftp-publish.yml`: on every push to `main`, Node 20, `npm install` + `npm run build` in `Thin/`, then FTP-Deploy-Action to `crawler.like.audio` (user `crawler@like.audio`, password from the `FTP_PASSWORD` secret) |
| **apk.audio / WEB.Frontend-Assets image** | the repo's sources, as part of the `PODS/POD.THIN/Softapps` tree | root `ci.yml` deploy and `WEB.Frontend-Assets/Docker/Dockerfile` `COPY ["PODS/POD.THIN/Softapps", …]` |
| **Desktop** | Thick, run from the checkout | `Thick/run_crawler.sh` / `.bat`; `Thick/Crawler.desktop` is a launcher entry |

A push to `main` is a release of crawler.like.audio.

## Build and test

- Thin: `cd Thin && npm ci && npm run build` (passes as of 2026-10-30; prerenders `/` with
  every sidebar entry). `npm run lint` runs ESLint.
- Thick: no build; `pip install -r Thick/requirements.txt`.
- Smoke result: [SMOKE.md](../🧩Manual%20and%20Artifacts/SMOKE.md).

## Not automated

- **No tests run anywhere.** The workflow builds and uploads; there is no test suite for either
  half and no lint step in CI.
- **The OS window's `Thin/out/` is not built by the APK.audio root CI** (it builds only the
  Scanalyzer's `Web_Front`), so on apk.audio the Crawler window has no `index.html` unless
  `Thin/out/` is built and published some other way.
- **The workflow uses `npm install`, not `npm ci`,** so a deploy can resolve different
  versions from the committed `package-lock.json`.
- **Thick is not packaged**; `installation.py` installs the requirements into the current
  Python.
