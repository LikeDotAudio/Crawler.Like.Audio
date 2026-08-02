"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Usb, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

export function UsbScannerView() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState('');

  const loadDevices = async () => {
    // @ts-ignore
    if (navigator.usb) {
      // @ts-ignore
      const usbDevices = await navigator.usb.getDevices();
      setDevices(usbDevices);
    } else {
      setError('WebUSB API is not supported in this browser. Please use Chrome or Edge.');
    }
  };

  useEffect(() => {
    loadDevices();
    
    // Listen for hot-plug events
    // @ts-ignore
    if (navigator.usb) {
      // @ts-ignore
      navigator.usb.addEventListener('connect', loadDevices);
      // @ts-ignore
      navigator.usb.addEventListener('disconnect', loadDevices);
    }
    
    return () => {
      // @ts-ignore
      if (navigator.usb) {
        // @ts-ignore
        navigator.usb.removeEventListener('connect', loadDevices);
        // @ts-ignore
        navigator.usb.removeEventListener('disconnect', loadDevices);
      }
    };
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      // @ts-ignore
      if (navigator.usb) {
        const exclusionFilters = devices.map(d => ({
          vendorId: d.vendorId,
          productId: d.productId
        }));
        
        const reqOptions: any = {};
        if (exclusionFilters.length > 0) {
          reqOptions.exclusionFilters = exclusionFilters;
        }

        // Prompt user to grant permission to a new USB device, excluding already paired ones
        // @ts-ignore
        await navigator.usb.requestDevice(reqOptions);
        await loadDevices(); // Reload the list of authorized devices
      }
    } catch (err) {
      console.log('User cancelled device authorization.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">USB Scanner</h2>
          <p className="text-muted-foreground mt-1">Authorize and inspect locally connected USB hardware.</p>
        </div>
        <Button onClick={handleScan} disabled={isScanning} className="gap-2 bg-primary hover:bg-primary/80 text-primary-foreground shadow-sm shadow-primary/20">
          <Plus className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Awaiting Prompt...' : 'Authorize New Device'}
        </Button>
      </div>
      
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-3 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {devices.length === 0 && !error ? (
        <div className="w-full h-64 border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
          <Usb className="w-12 h-12 mb-4 opacity-20" />
          <p>No devices authorized yet.</p>
          <p className="text-xs mt-1 opacity-60">Click "Authorize New Device" to grant browser access to your hardware.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device, i) => {
            const hexVendor = device.vendorId.toString(16).padStart(4, '0');
            const hexProduct = device.productId.toString(16).padStart(4, '0');
            
            return (
              <Card key={i} className="border-border/50 bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="bg-primary/10 p-3 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Usb className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground" title="VendorID:ProductID">
                      {hexVendor}:{hexProduct}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-base line-clamp-1">{device.productName || 'Unknown USB Device'}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">{device.manufacturerName || 'Unknown Manufacturer'}</div>
                  <CardDescription className="mt-3 flex flex-wrap gap-3 text-xs font-mono">
                    <span className="bg-background px-2 py-1 rounded border border-border/50">Class: {device.deviceClass}</span>
                    <span className="bg-background px-2 py-1 rounded border border-border/50">USB {device.usbVersionMajor}.{device.usbVersionMinor}</span>
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
