import { errorMessage } from "@/lib/utils";

export interface UsbLogCallback {
    (log: string, limit?: number): void;
}

export const connectAndDumpDevice = async (device: USBDevice, addLog: UsbLogCallback) => {
  addLog(`[SYSTEM] Connecting to ${device.productName || 'Device'}...`);
  try {
    await device.open();
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
  }
};

export const startUsbStreamEngine = async (
  selectedUsb: USBDevice | null,
  streamActive: { current: boolean }, 
  addLog: UsbLogCallback,
  onStreamStateChange: (isStreaming: boolean) => void
) => {
  if (!selectedUsb) return;
  try {
    if (!selectedUsb.configuration) {
       await selectedUsb.selectConfiguration(1);
    }
    await selectedUsb.claimInterface(0);
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
  }
};
