"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Usb, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function UsbScannerView() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([
    { id: '1a2b:3c4d', name: 'Logitech USB Receiver', bus: '001', device: '004' },
    { id: '8087:0a2b', name: 'Intel Corp. Bluetooth wireless interface', bus: '001', device: '003' },
    { id: '046d:c52b', name: 'Logitech, Inc. Unifying Receiver', bus: '002', device: '002' },
  ]);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1500);
  };

  return (
    <div className="w-full h-full flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">USB Scanner</h2>
          <p className="text-muted-foreground mt-1">Detect and monitor connected hardware devices.</p>
        </div>
        <Button onClick={handleScan} disabled={isScanning} className="gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground shadow-sm">
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Refresh Devices'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device, i) => (
          <Card key={i} className="border-border/50 bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 group">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="bg-primary/10 p-3 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Usb className="w-6 h-6 text-primary" />
                </div>
                <div className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                  {device.id}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-base line-clamp-1">{device.name}</CardTitle>
              <CardDescription className="mt-2 flex gap-4 text-xs font-mono">
                <span>Bus: {device.bus}</span>
                <span>Dev: {device.device}</span>
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
