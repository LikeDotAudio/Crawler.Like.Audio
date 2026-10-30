// Chromium-only browser APIs the Thin app feature-detects at runtime but that
// TypeScript's lib.dom does not declare: File System Access
// (showDirectoryPicker), WebUSB, Web Bluetooth and Web Serial. Only the members
// this app touches are declared; every entry point is optional because the app
// checks for it before use.

interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
}

interface USBEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
  packetSize: number;
}

interface USBAlternateInterface {
  interfaceClass: number;
  endpoints: USBEndpoint[];
}

interface USBInterface {
  interfaceNumber: number;
  alternate: USBAlternateInterface;
}

interface USBConfiguration {
  configurationValue: number;
  interfaces: USBInterface[];
}

interface USBInTransferResult {
  data?: DataView;
  status: 'ok' | 'stall' | 'babble';
}

interface USBControlTransferParameters {
  requestType: 'standard' | 'class' | 'vendor';
  recipient: 'device' | 'interface' | 'endpoint' | 'other';
  request: number;
  value: number;
  index: number;
}

interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  usbVersionMajor: number;
  usbVersionMinor: number;
  deviceClass: number;
  deviceSubclass: number;
  configuration: USBConfiguration | null;
  configurations: USBConfiguration[];
  readonly opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  controlTransferIn(setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
}

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
}

interface USBDeviceRequestOptions {
  filters?: USBDeviceFilter[];
  exclusionFilters?: USBDeviceFilter[];
}

interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options?: USBDeviceRequestOptions): Promise<USBDevice>;
}

interface BluetoothDevice {
  id: string;
  name?: string;
}

interface Bluetooth {
  requestDevice(options: { acceptAllDevices: boolean }): Promise<BluetoothDevice>;
}

// Opaque: the app only lists authorized ports, it never opens one.
type SerialPort = object;

interface Serial {
  requestPort(): Promise<SerialPort>;
}

interface Navigator {
  readonly usb?: USB;
  readonly bluetooth?: Bluetooth;
  readonly serial?: Serial;
}

// lamejs, loaded from cdnjs by AudioConverterView's <Script>.
interface LameMp3Encoder {
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
  flush(): Int8Array;
}

interface Window {
  lamejs?: { Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LameMp3Encoder };
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  webkitAudioContext?: typeof AudioContext;
}

interface DataTransferItem {
  // File System Access drag-and-drop (Chromium); absent elsewhere.
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
}
