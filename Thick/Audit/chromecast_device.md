# Chromecast (Google Cast) Protocol Audit Strategy

## Overview
This strategy outlines how the Universal Local Relay Proxy (detailed in `DNS.md`) can be specifically adapted to discover, categorize, and audit Chromecasts, Google Nest speakers, and Cast Groups on the local network.

Similar to the Apple TV audit strategy, this module is strictly for **passive discovery**. It does not attempt to initiate Cast V2 control connections (which require TLS sockets on port 8009 and Protobuf serialization) to avoid disrupting user media playback or requiring heavy protocol implementations.

---

## 1. The Cast Footprint
Unlike Apple TVs which broadcast 8+ different services for a single device, Google Cast devices are much cleaner. They broadcast a single definitive mDNS service:

* `_googlecast._tcp`

The entire audit relies on decoding the TXT record attached to this single broadcast. 

---

## 2. Parsing the TXT Record
The `_googlecast._tcp` TXT record uses a short-key format. The crawler's parser must map these keys to human-readable JSON properties for the frontend UI:

* `fn` -> **Friendly Name**: The name the user gave the device (e.g., "Living Room TV").
* `md` -> **Model**: The hardware model (e.g., "Chromecast", "Google Home Mini").
* `id` -> **Cast ID**: The unique identifier/UUID for the device.
* `rs` -> **Status Text**: Usually displays the current app running or `"idle"` if nothing is casting.
* `ve` -> **Protocol Version**: E.g., `05` for Cast V2.
* `ca` -> **Capabilities**: A numeric bitmask defining what the hardware can do (audio, video, display, etc.).

---

## 3. The Capability (`ca`) Bitmask Strategy
The `ca` value is a bitmask, but Google does not officially document all the bits. Only the lowest bits (e.g., audio out, video out) are stable and well-known by the community.

* *Audit Rule:* The crawler should decode the known low-bits into flags (e.g., `audio_out`), but it **must** always publish the raw integer value alongside the decoded flags (e.g., `audio_out, ... (raw:198660)`). 
* Do not attempt to guess or invent meanings for undocumented high-bits, as a wrong guess dressed as a fact is worse than an undecoded number.

---

## 4. Derived Device Categorization
To make the Audit UI useful, the crawler should automatically file discovered devices into one of five categories:
1. `Speaker`
2. `Video Cast`
3. `Smart Display`
4. `Speaker Group`
5. `Cast Device` (Fallback)

**Categorization Logic:**
Category is derived, not intrinsic. The crawler should first look at the `md` (model) string to classify the device. If the model string is ambiguous (e.g., just "Chromecast"), it should fall back to checking the `ca` capability bits (e.g., if it lacks video-out capabilities, it's a "Chromecast Audio" and goes in the `Speaker` category).

**The Re-Classification Trap:**
Because category is derived, if the classifier's logic improves (or if a device updates its capabilities during runtime), the device might change categories. The UI state management must be careful to remove the device from its old category before adding it to the new one, otherwise, the same physical device will appear as a duplicate under both `Video Cast` and `Speaker`.
