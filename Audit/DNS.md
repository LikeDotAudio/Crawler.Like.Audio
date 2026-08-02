# mDNS & DNS-SD Browser Strategy

## The Challenge: Multicast UDP in the Browser
mDNS (Multicast DNS) and DNS-SD (DNS Service Discovery) operate by broadcasting and listening to **multicast UDP packets on port 5353** (typically at address `224.0.0.251`). 

Just like with SNMP, modern web browsers **strictly prohibit web pages from opening raw UDP sockets**, and they absolutely do not allow subscribing to multicast groups. While experimental APIs exist for specific use cases (like the Presentation API for finding Chromecasts), there is no general-purpose Web API for a web page to perform a raw mDNS discovery sweep of the local network.

To achieve this in a 100% frontend static app like `crawler.like.audio`, we face the exact same architectural hurdle as the SNMP scanner.

---

## Strategy: The Universal Local Relay Proxy

Because both SNMP and mDNS require raw UDP socket access, we can consolidate both features into a single **Universal Local Relay Proxy**.

### How it Works
1. **The Utility Node**: The user runs a small, open-source script locally (e.g., `npx crawler-net-relay`).
2. **WebSocket Bridge**: This local script spins up a local WebSocket server (`ws://localhost:8080`) that the web frontend connects to.
3. **The Commands**: 
   - From the web UI, the user clicks "Start mDNS Scan".
   - The React app sends a JSON message over the WebSocket: `{ "action": "start_mdns" }`.
4. **The Execution**: The local Node script utilizes a library like `multicast-dns` or `bonjour` to listen on UDP port 5353.
5. **The Stream**: As local services (like AirPrint printers, Apple TVs, local web servers, and IoT devices) broadcast their presence, the Node script captures the DNS-SD packets and instantly forwards them over the WebSocket.
6. **The Visualization**: The React frontend receives this live stream of network devices and dynamically renders them in the UI (or graphs them in React Flow).

### Pros
* **Two Birds, One Stone**: By building one local WebSocket relay, you instantly unlock the ability to do **both** SNMP and mDNS (and even raw TCP port scanning or Ping sweeps) from your web app.
* **Privacy First**: The scanning happens entirely on the user's private local network. The cloud web host (`crawler.like.audio`) never sees the local network topology.

### The Frontend Implementation (mDNS Dashboard)

If the relay is running, the **Project Audit -> Network** tab in the UI would feature an mDNS Browser that displays:
* **Service Types**: e.g., `_http._tcp`, `_printer._tcp`, `_airplay._tcp`.
* **Hostnames & IPs**: e.g., `living-room-tv.local -> 192.168.1.50`.
* **TXT Records**: The metadata attached to the broadcast (like device model, status, or firmware version).

Because mDNS is "chatty" (devices broadcast frequently), the UI would act as a live, real-time scrolling feed or a dynamic node graph that grows as more devices announce themselves on the network.
