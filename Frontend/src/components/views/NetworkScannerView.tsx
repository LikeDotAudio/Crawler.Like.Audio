"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Network, Play, Square, Activity, Wifi } from 'lucide-react';

export function NetworkScannerView() {
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [baseIp, setBaseIp] = useState('192.168.1');
  const [foundHosts, setFoundHosts] = useState<{ ip: string; status: string; latency: number }[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const scanIp = async (ip: string): Promise<{ alive: boolean; latency: number }> => {
    return new Promise((resolve) => {
      const start = performance.now();
      const img = new Image();
      let handled = false;

      const finish = (alive: boolean) => {
        if (handled) return;
        handled = true;
        const latency = performance.now() - start;
        resolve({ alive, latency });
      };

      img.onload = () => finish(true);
      img.onerror = () => {
        // A rejection (onerror) that happens very fast usually means the host is up but rejected the connection (RST).
        // A slow rejection usually means timeout (host is down).
        const time = performance.now() - start;
        if (time < 1500) {
          finish(true); // Host likely alive and actively refused connection
        } else {
          finish(false); // Timeout
        }
      };

      img.src = `http://${ip}:80/favicon.ico?rand=${Math.random()}`;
      
      // Hard timeout
      setTimeout(() => finish(false), 2000);
    });
  };

  const handleStartScan = async () => {
    if (!baseIp.match(/^(?:[0-9]{1,3}\.){2}[0-9]{1,3}$/)) {
      addLog('[ERROR] Invalid Base IP format. Use e.g., 192.168.1');
      return;
    }

    setIsScanning(true);
    setFoundHosts([]);
    setLogs([]);
    addLog(`[INFO] Starting LAN Sweeper on ${baseIp}.x ...`);
    addLog(`[INFO] Using JS Timing Attack heuristics. This may take a minute.`);

    const concurrency = 20;
    const ipsToScan = Array.from({ length: 254 }, (_, i) => `${baseIp}.${i + 1}`);
    
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < ipsToScan.length && isScanning) {
        const ip = ipsToScan[currentIndex++];
        try {
          const { alive, latency } = await scanIp(ip);
          if (alive) {
            addLog(`[SUCCESS] Host Found: ${ip} (Responded in ${latency.toFixed(1)}ms)`);
            setFoundHosts(prev => [...prev, { ip, status: 'Alive', latency }]);
          }
        } catch (e) {
          // ignore
        }
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    if (isScanning) {
      addLog('[INFO] LAN Sweep Complete!');
      setIsScanning(false);
    }
  };

  const handleStop = () => {
    setIsScanning(false);
    addLog('[INFO] Scan manually aborted.');
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Network className="w-8 h-8 text-primary" /> LAN IP Sweeper
        </h2>
        <p className="text-muted-foreground mt-1">Discover live devices on your local network natively in the browser using timing attacks.</p>
      </div>

      <div className="flex gap-4">
        <Card className="w-1/3 shadow-md border-border/50 bg-card/80 backdrop-blur-sm h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <Wifi className="w-5 h-5" /> Subnet Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Base IP Range (e.g., 192.168.1)</label>
              <input 
                type="text" 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" 
                placeholder="192.168.1"
                value={baseIp}
                onChange={e => setBaseIp(e.target.value)}
                disabled={isScanning}
              />
            </div>

            {!isScanning ? (
              <Button onClick={handleStartScan} className="w-full gap-2 shadow-lg shadow-primary/20">
                <Play className="w-4 h-4" /> Start Network Sweep
              </Button>
            ) : (
              <Button onClick={handleStop} variant="destructive" className="w-full gap-2 animate-pulse">
                <Square className="w-4 h-4 fill-current" /> Stop Scanner
              </Button>
            )}

            {foundHosts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <h4 className="text-sm font-semibold mb-2">Discovered Hosts: {foundHosts.length}</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {foundHosts.map(host => (
                    <div key={host.ip} className="flex justify-between items-center bg-background/50 p-2 rounded border border-border/50 text-sm">
                      <span className="font-mono text-primary">{host.ip}</span>
                      <span className="text-xs text-muted-foreground">{host.latency.toFixed(0)}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="w-2/3 shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
          <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Live Execution Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden relative min-h-[500px]">
            <div className="absolute inset-0 bg-[#0d0d12] p-4 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-muted-foreground/50 h-full flex items-center justify-center italic">Configure subnet and start sweep...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.includes('[SUCCESS]') ? 'text-green-400' : log.includes('[ERROR]') ? 'text-red-400' : 'text-slate-300'}`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
