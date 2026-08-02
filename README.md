# Crawler.Like.Audio

A powerful, 100% client-side developer utility suite built entirely with **Next.js, TypeScript, and WebAssembly**. It is designed to run statically in the browser with absolutely zero backend dependencies or local installations required.

## 🚀 Features

The suite is broken down into several hyper-capable modules that push the limits of modern browser APIs:

### 📁 File Crawler & Visual Explorer
* **File System Access API:** Granularly crawls any local project directory directly in the browser.
* **Smart Parsing:** Respects `.gitignore` rules (or ignores them if forced), maps file extensions to visual emojis, and builds a massive `MAP.txt` artifact.
* **React Flow Visualization:** Renders the crawled file architecture into an interactive, depth-filterable node graph.
* **AST Parsing:** Uses WebAssembly to structurally parse code files (like Python classes and functions) completely offline.

### 🛡️ Project Auditor
Deep-scans your local codebase for structural and security metrics:
* **Secrets Scanner:** Hunts for exposed API keys, passwords, and rogue `.env` files.
* **Endpoint Extractor:** Rips through the codebase to extract all hardcoded URLs and API endpoints.
* **Future Implementations:** Dependency auditing, dead code detection, and complexity profiling.

### 📡 Network Sweeper
* **LAN IP Sweeper (Timing Attacks):** Maps out your local network (e.g., `192.168.1.x`) and discovers live routers, IoT devices, and local web servers **100% inside the browser** using clever HTTP fetch timing heuristics. No raw UDP sockets needed.

### 🖲️ Hardware Auditor
Hooks deeply into the browser's native hardware APIs to act as a complete peripheral scanner:
* **WebUSB API:** Discovers and authorizes connected USB peripherals.
* **Web Bluetooth (BLE):** Radar sweeps for nearby Bluetooth Low Energy devices, beacons, and Smart TVs.
* **Web Serial API:** Hunts for connected RS-232 devices, Arduinos, and industrial COM ports.
* **Media Devices (WebRTC):** Silently indexes every camera, microphone, and audio output connected to the system.

### 📄 PDF to MD Converter
* Client-side PDF parsing using `pdfjs-dist` to extract structured Markdown from PDF documents, bypassing the need for cloud extraction APIs.

---

## 🛠️ Architecture

* **Frontend Framework:** Next.js 14+ (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS + shadcn/ui
* **State Management:** Zustand
* **Deployment Target:** Static Export (`out/`) targeting `crawler.like.audio`

Because this project is designed as a **Static Frontend**, there is no backend server. All hardware scanning, network sweeping, and file parsing happens strictly within the secure sandbox of the user's browser execution thread.

## 💻 Running Locally

1. Install dependencies:
```bash
cd Frontend
npm install
```

2. Start the Turbopack dev server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

---

## 🤝 Contributing
Since the goal is a 100% backend-free suite, any new auditing functions (like SNMP walks or mDNS browsers) must be designed either as native browser hacks (like the LAN timing attack sweeper) or via an optional lightweight Local Relay WebSocket script for advanced networking.

*Repository renamed from PyCrawler to Crawler.Like.Audio.*
