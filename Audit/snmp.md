# SNMP Crawler Strategy & Architecture

## The Challenge: Browser Networking Limits
Modern web browsers sandbox networking strictly to HTTP, WebSockets, and WebRTC. SNMP operates over **UDP (Port 161)**. Because browsers do not provide access to raw UDP or TCP sockets, a 100% client-side web application cannot directly send SNMP requests or perform an SNMP walk to query network devices like routers, switches, or printers.

Even if an SNMP library were compiled to WebAssembly (WASM), the browser's execution environment would intercept and block the raw UDP packet generation.

To implement an SNMP Crawler in a web interface, we must introduce a bridge that can speak raw UDP.

---

## Strategy 1: The Local Relay Proxy (Recommended for Desktop Tools)

Since this project aims for a static deployment (`crawler.like.audio`) without a centralized backend, the best way to maintain privacy and allow users to scan their own local networks is a **Local Relay Proxy**.

### How it Works
1. **The Relay Script**: The user downloads and runs a tiny, single-file Node.js or Go script on their local machine (e.g., `npx crawler-snmp-relay` or a downloaded binary).
2. **The WebSocket Bridge**: The script starts a local WebSocket server (e.g., `ws://localhost:8080`).
3. **The Web UI**: In the web browser (`crawler.like.audio`), the user enters the Target IP and Community String. The browser sends these via WebSocket to the local relay.
4. **The Execution**: The local relay, which has full OS-level networking access, performs the raw UDP SNMP walk against the target IP.
5. **The Response**: The relay parses the MIB/OID data and streams the JSON payload back through the WebSocket to the browser, where it is visualized in React Flow.

### Pros
* Keeps the static web app strictly frontend.
* Zero infrastructure costs—no backend servers to host.
* 100% secure: The web app does not need to know the user's private network architecture; the scanning happens entirely inside the user's LAN.

### Cons
* Requires the user to open a terminal and run a local script before the feature works.

---

## Strategy 2: The Hosted Backend API (Recommended for Cloud Tools)

If you are willing to break the "no backend" rule for this specific feature, we can deploy a tiny serverless API or Node/Express server.

### How it Works
1. **The API**: A backend server exposes an endpoint like `POST https://api.crawler.like.audio/snmp`.
2. **The Request**: The React frontend sends an HTTP request containing the IP address and Community String to the API.
3. **The Execution**: The server performs the SNMP walk on behalf of the user.
4. **The Response**: The server returns the JSON results to the frontend over HTTP.

### Pros
* Frictionless for the user. It "just works" right in the browser without downloading extra scripts.

### Cons
* **Fatal Flaw for LANs**: A cloud-hosted backend API *cannot* scan devices on the user's private local network (e.g., `192.168.1.1`). It can only scan publicly exposed IP addresses over the internet.
* Introduces server hosting requirements and security concerns regarding passing Community Strings over the web.

---

## Implementation Roadmap

If we proceed with **Strategy 1 (Local Relay)**, here is the roadmap:

1. **Create the Relay CLI**: Write a lightweight Node script utilizing the `net-snmp` library and `ws` (WebSockets) library.
2. **Update the UI**: Add a new module in the `AuditView` called **SNMP Network Walker**.
3. **Connection State**: Add a visual indicator in the UI showing whether the `ws://localhost` relay is connected.
4. **Data Handling**: Build a parser in the frontend to convert the OID tree into nodes for the `VisualExplorerView` graph, allowing users to visually navigate the MIB tree of their network hardware.
