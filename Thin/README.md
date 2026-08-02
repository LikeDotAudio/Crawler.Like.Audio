# Crawler.like.audio

Crawler.like.audio is a powerful, browser-based multi-tool built with Next.js, React, and Tailwind CSS. It is designed to be an all-in-one local file analyzer, media converter, web scraper, and system diagnostic suite. Featuring a sleek, dark-mode, neon-accented UI, the application leverages modern web APIs like the File System Access API to perform heavy workloads directly in your browser.

## 🚀 Features & Tools

### 📁 Local Folder and File Crawler
- **File Crawler:** Recursively scan local directories and aggregate code or text files into a single, comprehensive view. Perfect for feeding large codebases into AI contexts.
- **Visual Explorer:** A beautiful, interactive node-based graph (powered by React Flow) that maps out the intricate relationships of your project's files and folders.
- **Program Map:** A detailed hierarchical tree view of your project's architectural structure.
- **SCOP Map (Project Scope Analyzer):** An interactive, highly-dense Treemap visualization (powered by `d3-hierarchy`). Inspired heavily by WinDirStat, it features beautiful 3D radial-gradient "cushions" allowing you to instantly visualize your project's footprint by file size and color-coded by file type.
- **Project Audit:** Automated auditing tools for scanning codebases and identifying structural patterns.
- **Regenerate:** A utility for modifying, regenerating, or transforming local code files.

### 🌐 Web & Generation
- **Web Scraper:** A powerful browser-side web scraping tool for extracting DOM data and content directly from URLs.
- **Media Link Downloader:** Paste any YouTube URL and download it natively! Powered by a Next.js API route integrating `yt-dlp` (`youtube-dl-exec`), you can instantly save videos as high-quality **MP4 Movies** or **MP3 Audio Only** streams directly to your machine.

### 🔄 Data & Document Conversion
- **PDF to MD:** Convert dense PDF documents into clean, readable Markdown formats using `pdf.js` and `turndown`.
- **CSV & JSON Importer/Shuffler:** Powerful data manipulation tools for ingesting, transforming, and converting complex hierarchical JSON and CSV data.
- **Spreadsheet Converter:** Instantly convert between popular spreadsheet formats (`.xlsx`, `.csv`, `.ods`, `.numbers`) directly in your browser. Powered by SheetJS.

### 🎵 Media Conversion
- **Audio Converter:** A native in-browser audio converter utilizing Web Audio API and `lamejs` via CDN. Allows you to import `.wav`, `.flac`, `.m4a`, and other formats, decode their audio buffers, and encode them directly into compressed `.mp3` files without ever sending your files to a server!

### 💻 Physical & Network
- **Hardware Auditor:** A dashboard for inspecting local machine hardware metrics and environment variables.
- **Network Sweeper:** Diagnostic tools for sweeping network information and inspecting connectivity parameters.

---

## 🛠️ Tech Stack & Architecture

- **Core Framework:** Next.js (App Router), React 19, TypeScript.
- **Styling:** Tailwind CSS (v4) with meticulously crafted dark mode, neon accents, and `framer-motion` micro-animations.
- **Visualizations:** `d3-hierarchy` for Treemaps, `@xyflow/react` for node graphs, `recharts` for data graphs.
- **File Processing:** `papaparse` (CSV), `xlsx` (Spreadsheets), `pdfjs-dist` (PDFs), `js-yaml` (YAML).
- **Audio & Media:** `lamejs` (Audio), `youtube-dl-exec` (Media Downloading).

## 🚀 Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
