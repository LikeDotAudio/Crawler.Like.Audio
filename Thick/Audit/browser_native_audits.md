# 100% Browser-Native Auditing Capabilities

If the strict requirement is **Zero Backend and Zero Local Relay Scripts**, we have to rely entirely on what the W3C and browser vendors allow within the JavaScript sandbox. 

While raw UDP (SNMP/mDNS) is blocked, the browser is actually a surprisingly powerful hardware and network auditing tool if you know which APIs and exploits to use.

Here is the master list of 100% browser-native auditing capabilities we can build into the Crawler:

---

## 1. Local Network LAN Sweeper (Timing Attacks)
While we can't send raw mDNS broadcasts, a web browser **can** attempt to load images or fetch requests from private IP addresses (e.g., `192.168.1.1` to `192.168.1.255`).

**How it works:**
1. The user inputs their local subnet (e.g., `192.168.1.0/24`).
2. The browser creates hundreds of hidden `<img src="http://192.168.1.X:80/favicon.ico">` requests or `fetch()` calls.
3. **The Trick:** Even though CORS prevents the browser from reading the *content* of the response, we can measure the **timing**.
   - If an IP returns an error in 10ms, the device exists and actively rejected the connection (Host is UP).
   - If it times out after 2000ms, the IP is empty (Host is DOWN).
   - If it succeeds, a web server is running on that device.
4. **Result:** A 100% browser-based LAN scanner that maps out routers, IoT devices, and local servers without any backend.

---

## 2. Web Bluetooth Scanner (BLE)
Modern Chromium browsers (Chrome, Edge, Opera) support the **Web Bluetooth API**.
* **Capabilities:** We can build a scanner that pops up a browser dialog showing every Bluetooth Low Energy (BLE) device physically near the user (Smart TVs, Headphones, Beacons, Apple AirTags, etc.).
* **Limitation:** The user must explicitly click "Pair" in the browser dialog to read deep GATT characteristics, but discovery is natively supported.

---

## 3. The Hardware I/O Suite
We can expand the Audit suite to scan physical hardware plugged into the machine using native APIs:
* **WebUSB API:** (Already implemented in your project).
* **Web Serial API:** Can scan for RS-232 devices, Arduinos, Raspberry Pis, and industrial equipment connected to COM ports.
* **WebHID API:** Can audit Human Interface Devices (custom keyboards, gamepads, medical devices) and read their input reports natively.
* **WebMIDI API:** Can discover all connected musical instruments, synthesizers, and audio controllers on the system.

---

## 4. Media Device Auditor (WebRTC)
Using `navigator.mediaDevices.enumerateDevices()`, the browser can silently audit all connected A/V hardware:
* Extracts a list of every camera, virtual camera (OBS), microphone, and audio output device.
* Can determine exactly what physical hardware the user has plugged in without needing any special permissions (permissions are only needed to *use* the camera, not to count them).

---

## 5. Network Information API
Using `navigator.connection`, the browser can audit the user's current physical network link:
* Discover whether they are on WiFi, Cellular (4G/5G), or Ethernet.
* Measure effective bandwidth and round-trip ping time (RTT).

---

## Summary of Possibilities

| Audit Type | 100% Browser Native? | Method |
| :--- | :--- | :--- |
| **LAN IP Sweeping** | ✅ Yes | HTTP/Image Timing Attacks |
| **Bluetooth Scanning** | ✅ Yes | Web Bluetooth API |
| **Serial / USB / MIDI** | ✅ Yes | Web Serial / WebUSB / WebMIDI |
| **Hardware A/V Devices**| ✅ Yes | WebRTC enumerateDevices |
| **mDNS / DNS-SD** | ❌ No | Requires Local Relay |
| **SNMP Walks** | ❌ No | Requires Local Relay |

If you want to stay 100% in the browser, I highly recommend we build the **LAN Timing Sweeper** and the **Web Bluetooth Scanner** next!
