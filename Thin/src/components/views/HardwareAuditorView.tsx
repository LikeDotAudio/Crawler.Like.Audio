"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Usb, Plus, AlertCircle, Bluetooth, Cpu, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export function HardwareAuditorView() {
  const [usbDevices, setUsbDevices] = useState<any[]>([]);
  const [btDevices, setBtDevices] = useState<any[]>([]);
  const [serialPorts, setSerialPorts] = useState<any[]>([]);
  const [mediaDevices, setMediaDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState('');
  
  const [selectedUsb, setSelectedUsb] = useState<any | null>(null);
  const [usbLogs, setUsbLogs] = useState<string[]>([]);

  const loadMediaDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMediaDevices(devices.filter(d => d.deviceId)); // filter out empty devices if no permissions
    } catch (e) {
      console.warn('Media devices error', e);
    }
  };

  useEffect(() => {
    // Load USB
    if ((navigator as any).usb) {
      (navigator as any).usb.getDevices().then(setUsbDevices).catch(console.warn);
    } else {
      setError('Some hardware APIs are not supported in this browser. Please use Chrome or Edge.');
    }

    // Load Media
    loadMediaDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadMediaDevices);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadMediaDevices);
    };
  }, []);

  const handleScanUsb = async () => {
    try {
      if ((navigator as any).usb) {
        const exclusionFilters = usbDevices.map(d => ({ vendorId: d.vendorId, productId: d.productId }));
        const reqOptions: any = {};
        if (exclusionFilters.length > 0) reqOptions.exclusionFilters = exclusionFilters;
        
        await (navigator as any).usb.requestDevice(reqOptions);
        const devices = await (navigator as any).usb.getDevices();
        setUsbDevices(devices);
      }
    } catch (err: any) {
      if (!err.message.includes('No device selected')) setError(err.message);
    }
  };

  const connectAndDump = async (device: any) => {
    setSelectedUsb(device);
    setUsbLogs([`[SYSTEM] Connecting to ${device.productName || 'Device'}...`]);
    try {
      await device.open();
      setUsbLogs(prev => [...prev, `[SYSTEM] Device opened. Configuration: ${device.configuration?.configurationValue || 'None'}`]);
      
      setUsbLogs(prev => [...prev, `[INFO] USB Version: ${device.usbVersionMajor}.${device.usbVersionMinor}`]);
      setUsbLogs(prev => [...prev, `[INFO] Device Class: ${device.deviceClass}, Subclass: ${device.deviceSubclass}`]);
      
      device.configurations.forEach((c: any) => {
        setUsbLogs(prev => [...prev, `[CFG] Found Configuration ${c.configurationValue}:`]);
        c.interfaces.forEach((i: any) => {
          setUsbLogs(prev => [...prev, `  ├─ Interface ${i.interfaceNumber} (Class ${i.alternate.interfaceClass})`]);
          i.alternate.endpoints.forEach((e: any) => {
            setUsbLogs(prev => [...prev, `  │  └─ Endpoint ${e.endpointNumber} (${e.direction} ${e.type}) [Size: ${e.packetSize}B]`]);
          });
        });
      });

      // Attempt to read the raw Device Descriptor via control transfer (Standard GET_DESCRIPTOR request)
      setUsbLogs(prev => [...prev, `[TX] 80 06 00 01 00 00 12 00 (GET_DESCRIPTOR)`]);
      const result = await device.controlTransferIn({
        requestType: 'standard',
        recipient: 'device',
        request: 0x06, // GET_DESCRIPTOR
        value: 0x0100, // DEVICE descriptor type (0x01) << 8 | index (0)
        index: 0x0000
      }, 18);
      
      if (result.status === 'ok') {
        const buffer = new Uint8Array(result.data.buffer);
        const hex = Array.from(buffer).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        setUsbLogs(prev => [...prev, `[RX] ${hex} (${buffer.length} bytes)`]);
      } else {
        setUsbLogs(prev => [...prev, `[RX] Status: ${result.status}`]);
      }
    } catch (e: any) {
      setUsbLogs(prev => [...prev, `[ERROR] ${e.message}`]);
      if (e.message.includes('Access denied')) {
        setUsbLogs(prev => [...prev, `[HINT] OS Kernel has claimed this device (e.g., keyboard/mouse). Cannot read raw packets without unbinding the kernel driver.`]);
      }
    }
  };

  const handleScanBluetooth = async () => {
    try {
      if ((navigator as any).bluetooth) {
        const device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true });
        if (device && !btDevices.find(d => d.id === device.id)) {
          setBtDevices(prev => [...prev, device]);
        }
      } else {
        setError('Web Bluetooth API is not supported in this browser.');
      }
    } catch (err: any) {
      if (!err.message.includes('cancelled')) setError(err.message);
    }
  };

  const handleScanSerial = async () => {
    try {
      if ((navigator as any).serial) {
        const port = await (navigator as any).serial.requestPort();
        if (port && !serialPorts.includes(port)) {
          setSerialPorts(prev => [...prev, port]);
        }
      } else {
        setError('Web Serial API is not supported in this browser.');
      }
    } catch (err: any) {
      if (!err.message.includes('No port selected')) setError(err.message);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Cpu className="w-8 h-8 text-primary" /> Hardware Auditor
        </h2>
        <p className="text-muted-foreground mt-1">Discover physical hardware peripherals connected to this machine completely natively.</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 h-full pb-10">
        {/* USB Devices */}
        <Card className="shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                <Usb className="w-5 h-5 text-primary" /> USB Devices ({usbDevices.length})
              </CardTitle>
              <Button size="sm" onClick={handleScanUsb} className="h-8 gap-1 shadow-md shadow-primary/20">
                <Plus className="w-4 h-4" /> Scan USB
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 relative">
            {selectedUsb ? (
              <div className="absolute inset-0 bg-black/90 p-3 m-4 rounded-xl flex flex-col z-10 border border-primary/30">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10 shrink-0">
                  <div className="font-mono text-xs text-primary font-bold">PACKET CAPTURE / DESCRIPTORS</div>
                  <Button size="sm" variant="ghost" className="h-6 text-xs hover:bg-white/10" onClick={() => {
                    selectedUsb.close().catch(()=>{});
                    setSelectedUsb(null);
                  }}>Close</Button>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] sm:text-xs text-green-400 leading-tight space-y-1 p-1">
                  {usbLogs.map((log, i) => (
                    <div key={i} className={log.startsWith('[TX]') ? 'text-blue-400' : log.startsWith('[RX]') ? 'text-yellow-400' : log.startsWith('[ERROR]') ? 'text-red-400' : log.startsWith('[HINT]') ? 'text-purple-400' : 'text-green-400'}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            ) : usbDevices.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground/50 italic text-sm">
                No USB devices authorized yet.
              </div>
            ) : (
              usbDevices.map((dev, i) => (
                <div 
                  key={i} 
                  onClick={() => connectAndDump(dev)}
                  className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background/50 hover:border-primary/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:scale-110 transition-transform"><Usb className="w-4 h-4" /></div>
                    <div>
                      <div className="text-sm font-semibold">{dev.productName || 'Unknown USB Device'}</div>
                      <div className="text-xs text-muted-foreground">{dev.manufacturerName || 'Unknown Manufacturer'}</div>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground group-hover:text-primary transition-colors">
                    VID:{dev.vendorId.toString(16).padStart(4, '0')} PID:{dev.productId.toString(16).padStart(4, '0')}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Bluetooth Devices */}
        <Card className="shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                <Bluetooth className="w-5 h-5 text-blue-400" /> Bluetooth Devices ({btDevices.length})
              </CardTitle>
              <Button size="sm" onClick={handleScanBluetooth} className="h-8 gap-1 bg-blue-500 hover:bg-blue-600 shadow-md shadow-blue-500/20 text-white">
                <Plus className="w-4 h-4" /> Scan BLE
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
            {btDevices.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground/50 italic text-sm">
                No Bluetooth devices authorized yet.
              </div>
            ) : (
              btDevices.map((dev, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background/50 hover:border-blue-400/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-blue-500/10 text-blue-400"><Bluetooth className="w-4 h-4" /></div>
                    <div>
                      <div className="text-sm font-semibold">{dev.name || 'Unknown BLE Device'}</div>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">{dev.id.substring(0, 8)}...</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Media Devices */}
        <Card className="shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" /> Media Devices ({mediaDevices.length})
              </CardTitle>
              <Button size="sm" onClick={() => navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(() => loadMediaDevices()).catch(() => {})} className="h-8 gap-1 bg-purple-500 hover:bg-purple-600 shadow-md shadow-purple-500/20 text-white">
                Request Access
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
            {mediaDevices.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground/50 italic text-sm text-center">
                Click 'Request Access' to view connected Cameras and Microphones.
              </div>
            ) : (
              mediaDevices.map((dev, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background/50 hover:border-purple-400/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-purple-500/10 text-purple-400"><Camera className="w-4 h-4" /></div>
                    <div>
                      <div className="text-sm font-semibold">{dev.label || `Unknown ${dev.kind}`}</div>
                      <div className="text-xs text-muted-foreground">{dev.kind}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Serial Ports */}
        <Card className="shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" /> Serial COM Ports ({serialPorts.length})
              </CardTitle>
              <Button size="sm" onClick={handleScanSerial} className="h-8 gap-1 bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20 text-white">
                <Plus className="w-4 h-4" /> Scan Serial
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
            {serialPorts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground/50 italic text-sm">
                No Serial COM ports authorized yet.
              </div>
            ) : (
              serialPorts.map((port, i) => (
                <div key={i} className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-background/50 hover:border-emerald-400/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400"><Cpu className="w-4 h-4" /></div>
                    <div>
                      <div className="text-sm font-semibold">Authorized COM Port</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
