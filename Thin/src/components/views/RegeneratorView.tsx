"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, FolderSearch, FileText, Upload } from 'lucide-react';
import { useState, useRef } from 'react';
import { restoreFiles } from '@/lib/regeneratorEngine';

export function RegeneratorView() {
  const [logFile, setLogFile] = useState<File | null>(null);
  const [outputDirHandle, setOutputDirHandle] = useState<any>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleBrowseDir = async () => {
    try {
      if ((window as any).showDirectoryPicker) {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        setOutputDirHandle(handle);
        addLog(`Selected output directory: ${handle.name}`);
      } else {
        addLog('[ERROR] Your browser does not support the File System Access API.');
      }
    } catch (e) {
      addLog('[WARN] Directory selection cancelled.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogFile(file);
      addLog(`Selected scrape file: ${file.name}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          try {
            // @ts-ignore - non-standard API but supported in chromium
            const handle = await item.getAsFileSystemHandle();
            if (handle?.kind === 'directory') {
              setOutputDirHandle(handle);
              addLog(`Selected output directory via drag & drop: ${handle.name}`);
            } else if (handle?.kind === 'file') {
              const file = await (handle as any).getFile();
              setLogFile(file);
              addLog(`Selected scrape file via drag & drop: ${file.name}`);
            }
          } catch (err) {
            // Fallback for browsers that don't support getAsFileSystemHandle
            const file = item.getAsFile();
            if (file) {
              setLogFile(file);
              addLog(`Selected scrape file via drag & drop: ${file.name}`);
            }
          }
        }
      }
    }
  };

  const handleRestore = async () => {
    if (!logFile || !outputDirHandle) return;
    setIsRestoring(true);

    try {
      await restoreFiles({
        logFile,
        outputDirHandle,
        onLog: addLog
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary" /> Project Regenerator
        </h2>
        <p className="text-muted-foreground mt-1">Unpack an EVERYTHING.LOG scrape file back into a physical file structure.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-md border-border/50 bg-card/80 backdrop-blur-sm h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <RefreshCw className="w-5 h-5" /> Regeneration Setup
            </CardTitle>
            <CardDescription>Select the log file and a destination folder.</CardDescription>
          </CardHeader>
          <CardContent 
            className={`space-y-6 transition-colors rounded-b-xl border-2 border-transparent p-6 ${isDragging ? 'bg-primary/10 border-primary border-dashed' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            
            <div className="space-y-2">
              <label className="text-sm font-medium">1. Scrape File</label>
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                variant="outline" 
                className="w-full gap-2 border-dashed bg-background/50"
                disabled={isRestoring}
              >
                <Upload className="w-4 h-4" /> 
                {logFile ? logFile.name : 'Select EVERYTHING.LOG'}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">2. Destination Directory</label>
              <Button 
                onClick={handleBrowseDir} 
                variant="outline" 
                className="w-full gap-2 border-dashed bg-background/50"
                disabled={isRestoring}
              >
                <FolderSearch className="w-4 h-4" /> 
                {outputDirHandle ? outputDirHandle.name : 'Select Empty Folder'}
              </Button>
            </div>
            
            <div className="pt-4 border-t border-border/50">
              <Button 
                onClick={handleRestore} 
                className="w-full gap-2 shadow-lg shadow-primary/20" 
                disabled={isRestoring || !logFile || !outputDirHandle}
              >
                <RefreshCw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} /> 
                {isRestoring ? 'Restoring...' : 'Start Restoration'}
              </Button>
            </div>

          </CardContent>
        </Card>
        
        <Card className="md:col-span-2 shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col h-[600px]">
          <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-muted-foreground" /> Restoration Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-full w-full bg-[#0d0d12] p-4 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-muted-foreground/50 h-full flex items-center justify-center italic">Awaiting configuration...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.includes('[ERROR]') ? 'text-red-400' : log.includes('[SUCCESS]') ? 'text-green-400' : log.includes('[WARN]') ? 'text-yellow-400' : 'text-slate-300'}`}>
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
