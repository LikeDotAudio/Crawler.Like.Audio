# Apple TV (AirPlay/Companion) Protocol Audit Strategy

## Overview
This strategy outlines how the Universal Local Relay Proxy (detailed in `DNS.md`) can be specifically adapted to discover, identify, and audit Apple TVs, HomePods, and other AirPlay receivers on the local network. 

The focus of this module is **discovery only**. It does not perform pairing, playback, or remote control, as those require pairing keys and encryption handshakes which fall outside the scope of network discovery.

---

## 1. The Multi-Role Footprint
Apple TVs are incredibly chatty on the mDNS (Bonjour) protocol. A single Apple TV device typically broadcasts a massive suite of services concurrently. To accurately audit an Apple TV, the crawler must group all of the following services by their shared **hostname** into a single "device" entity:

* `_airplay._tcp` (AirPlay Video/Mirroring)
* `_raop._tcp` (AirPlay Audio)
* `_homekit._tcp` (HomeKit Integration)
* `_hap._tcp` (HomeKit Accessory Protocol)
* `_companion-link._tcp` (Apple Continuity)
* `_mediaremotetv._tcp` (Media Remote)
* `_touch-able._tcp` (Legacy Remote)
* `_sleep-proxy._udp` (Sleep Proxy)

By grouping these, the crawler can populate a `roles` column to show exactly what capabilities a given hardware node is exposing.

---

## 2. Parsing `_raop._tcp` (The Data Goldmine)
While most of the mDNS services above broadcast empty or generic TXT records, the `_raop._tcp` service is rich with metadata. The crawler's parser should specifically decode the TXT record of `_raop` to extract:

* `am=` (Model Identifier): E.g., `AppleTV5,3` maps to "Apple TV HD (4th gen)".
  * *Rule:* Unknown identifiers must pass through verbatim (e.g., `AppleTV99,9`). Do not invent or guess models if they are not in the dictionary.
* `ov=` (tvOS Version): E.g., `26.5`
* `vs=` (AirPlay Source Version): E.g., `950.7.1`
* `cn=` (Codecs): A comma-separated index (e.g., `0,1,2,3`) that maps to audio capabilities like `PCM`, `ALAC`, `AAC`, `AAC-ELD`.
* `md=` (Metadata): Feature flags mapping to capabilities like `text`, `artwork`, `progress`.
* `ft=` (Feature Bitmask): Because Apple's feature bitmasks vary wildly across tvOS releases and are only partially public, they should be published as raw hex (`0x5A7FDFD5...`) rather than attempting a flawed translation.

---

## 3. The `_sleep-proxy` Trap
A critical edge case in auditing Apple hardware is the `_sleep-proxy._udp` service. 
While Apple TVs broadcast this service to wake sleeping devices on the network, **routers, AirPort base stations, and Mac computers also broadcast it.**

* *Audit Rule:* The presence of a `_sleep-proxy` service alone is **not** enough to classify a node as an Apple TV. 
* A device must only be flagged as an Apple TV/HomePod if the `_sleep-proxy` is accompanied by one of the definitive services: `airplay`, `airplay-audio`, `homekit`, `homekit-hap`, or `media-remote`.

---

## 4. TXT Record Merge Logic
Because a single physical device broadcasts 8+ mDNS services, the crawler will receive multiple overlapping TXT records for the same hostname. 

To prevent data loss, the state management logic must employ a **"Fill gaps, never overwrite"** merge rule. Because `_raop` carries the rich record and the others are nearly empty, a naive "last-write-wins" architecture would erase the decoded codecs and model numbers if a blank `_airplay` broadcast arrived one millisecond later.
