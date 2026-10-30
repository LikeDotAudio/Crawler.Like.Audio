/**
 * hardwareAuditorEngine.ts — the WebUSB half of HardwareAuditorView: dump a
 * device's descriptors (connectAndDumpDevice) and stream interface 0's IN
 * endpoint (startUsbStreamEngine). Web Bluetooth, Web Serial and WebRTC are
 * driven from the view itself.
 *
 * EVERY ONE OF THE BROWSER PROMPTS fails differently. A refused prompt throws;
 * an unsupported API is missing from `navigator` entirely; a device claimed by
 * a kernel driver opens and then errors on transfer. So every entry point
 * guards on the API existing before it is called, and "not supported",
 * "declined" and "in use" are reported as different answers — collapsing them
 * into one error makes the tool useless.
 *
 * All of them are gated on a secure context and on a user gesture: none of this
 * can be started from page load, and calling it outside a click handler fails
 * in a way that looks like a refusal.
 *
 * READ-ONLY BY INTENT. It reads descriptors and IN endpoints; it must never
 * write to an endpoint or pair.
 */

import { errorMessage } from "@/lib/utils";

export interface UsbLogCallback {
    (log: string, limit?: number): void;
}

export const connectAndDumpDevice = async (device: USBDevice, addLog: UsbLogCallback) => {
  addLog(`[SYSTEM] Connecting to ${device.productName || 'Device'}...`);
  // A dump borrows the device and gives it back: left open, the next application
  // (or this page's stream) finds it busy.
  const openedHere = !device.opened;
  try {
    if (openedHere) await device.open();
    addLog(`[SYSTEM] Device opened. Configuration: ${device.configuration?.configurationValue || 'None'}`);
    
    addLog(`[INFO] USB Version: ${device.usbVersionMajor}.${device.usbVersionMinor}`);
    addLog(`[INFO] Device Class: ${device.deviceClass}, Subclass: ${device.deviceSubclass}`);
    
    device.configurations.forEach((c) => {
      addLog(`[CFG] Found Configuration ${c.configurationValue}:`);
      c.interfaces.forEach((i) => {
        addLog(`  ├─ Interface ${i.interfaceNumber} (Class ${i.alternate.interfaceClass})`);
        i.alternate.endpoints.forEach((e) => {
          addLog(`  │  └─ Endpoint ${e.endpointNumber} (${e.direction} ${e.type}) [Size: ${e.packetSize}B]`);
        });
      });
    });

    // Attempt to read the raw Device Descriptor via control transfer (Standard GET_DESCRIPTOR request)
    addLog(`[TX] 80 06 00 01 00 00 12 00 (GET_DESCRIPTOR)`);
    const result = await device.controlTransferIn({
      requestType: 'standard',
      recipient: 'device',
      request: 0x06,
      value: 0x0100,
      index: 0x0000
    }, 18);
    
    if (result.status === 'ok' && result.data) {
      const buffer = new Uint8Array(result.data.buffer);
      const hex = Array.from(buffer).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      addLog(`[RX] ${hex} (${buffer.length} bytes)`);
    } else {
      addLog(`[RX] Status: ${result.status}`);
    }
  } catch (e) {
    addLog(`[ERROR] ${errorMessage(e)}`);
    if (errorMessage(e).includes('Access denied')) {
      addLog(`[HINT] OS Kernel has claimed this device (e.g., keyboard/mouse). Cannot read raw packets without unbinding the kernel driver.`);
    }
  } finally {
    if (openedHere && device.opened) await device.close().catch(() => {});
  }
};

export const startUsbStreamEngine = async (
  selectedUsb: USBDevice | null,
  streamActive: { current: boolean }, 
  addLog: UsbLogCallback,
  onStreamStateChange: (isStreaming: boolean) => void
) => {
  if (!selectedUsb) return;
  // What this loop takes it releases when the loop stops, however it stops.
  let claimed = false;
  const openedHere = !selectedUsb.opened;
  try {
    if (openedHere) await selectedUsb.open();
    if (!selectedUsb.configuration) {
       await selectedUsb.selectConfiguration(1);
    }
    await selectedUsb.claimInterface(0);
    claimed = true;
    onStreamStateChange(true);
    streamActive.current = true;
    addLog(`[STREAM] Claimed Interface 0. Starting interrupt loop...`);
    
    const iface = selectedUsb.configuration?.interfaces[0]?.alternate;
    const inEndpoint = iface?.endpoints.find((e) => e.direction === 'in');
    
    if (!inEndpoint) {
        addLog(`[ERROR] No IN endpoint found on Interface 0.`);
        onStreamStateChange(false);
        streamActive.current = false;
        return;
    }

    const epNumber = inEndpoint.endpointNumber;
    const size = inEndpoint.packetSize || 64;

    while (streamActive.current) {
       try {
           const result = await selectedUsb.transferIn(epNumber, size);
           if (result.status === 'ok' && result.data) {
               const buffer = new Uint8Array(result.data.buffer);
               const hex = Array.from(buffer).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
               addLog(`[STREAM-RX] ${hex}`, 50);
           }
       } catch (err) {
           addLog(`[STREAM-ERROR] ${errorMessage(err)}`);
           streamActive.current = false;
           onStreamStateChange(false);
           break;
       }
    }
  } catch (err) {
    const msg = errorMessage(err);
    addLog(`[STREAM-ERROR] ${msg}`);
    if (msg.includes('Access denied')) {
      addLog(`[HINT] The OS kernel currently owns Interface 0. You must detach the kernel driver or use a device without OS drivers.`);
    } else if (msg.includes('protected class')) {
      addLog(`[HINT] WebUSB blocks access to HID (Keyboard/Mouse), Audio/MIDI, Video, and Mass Storage devices for security. Try the Web MIDI API instead for MIDI devices!`);
    }
  } finally {
    streamActive.current = false;
    onStreamStateChange(false);
    if (claimed) await selectedUsb.releaseInterface(0).catch(() => {});
    if (openedHere && selectedUsb.opened) await selectedUsb.close().catch(() => {});
    if (claimed) addLog(`[STREAM] Released Interface 0.`);
  }
};
