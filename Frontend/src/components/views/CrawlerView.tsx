"use client";

import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderSearch, Play, Square, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { FileTypeSelector } from './FileTypeSelector';
import { astParser } from '@/lib/astParser';

export function CrawlerView() {
  const { isCrawling, setIsCrawling, selectedFolder, setSelectedFolder, recentFolders, addRecentFolder, crawlLogs, addCrawlLog } = useAppStore();
  const [targetPath, setTargetPath] = useState(selectedFolder || '');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [dirHandle, setDirHandle] = useState<any>(null);

  const handleStart = async () => {
    if (!dirHandle) {
      addCrawlLog('[WARN] You must click "Browse..." to grant the browser permission to read a local folder.');
      return;
    }
    
    if (targetPath) {
      addRecentFolder(targetPath);
    }
    
    setIsCrawling(true);
    addCrawlLog(`[INFO] Starting recursive crawl on ${dirHandle.name}...`);
    
    try {
      addCrawlLog('[INFO] Booting web-tree-sitter WASM engine...');
      await astParser.init();
      addCrawlLog('[SUCCESS] WebAssembly engine initialized for Python parsing.');
    } catch (e) {
      console.error(e);
      addCrawlLog('[ERROR] Failed to load WASM engine.');
    }
    
    let fileCount = 0;
    let dirCount = 0;
    let extCounts: Record<string, number> = {};
    let totalSize = 0;

    const crawlDirectory = async (handle: any, path: string) => {
      // Check store state directly to allow stopping mid-crawl
      if (!useAppStore.getState().isCrawling) return;
      
      try {
        for await (const entry of handle.values()) {
          if (!useAppStore.getState().isCrawling) break;
          
          if (entry.kind === 'file') {
            fileCount++;
            
            // Periodically log progress to avoid flooding the UI
            if (fileCount % 500 === 0) {
              addCrawlLog(`[INFO] Scanned ${fileCount} files so far...`);
            }
            
            // Get actual file object to read size and extension
            try {
              const file = await entry.getFile();
              totalSize += file.size;
              
              const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : 'unknown';
              extCounts[ext] = (extCounts[ext] || 0) + 1;

              // Run AST Parsing natively in browser for python files
              if (ext === '.py' && file.size < 1024 * 500) {
                try {
                  const text = await file.text();
                  const metrics = astParser.extractMetrics(text);
                  if (metrics.classCount > 0 || metrics.functionCount > 0) {
                    addCrawlLog(`[AST] ${file.name} -> ${metrics.classCount} classes, ${metrics.functionCount} functions`);
                  }
                } catch(e) {
                  // Silent fail on unparseable files to not flood UI
                }
              }
            } catch (e) {
              // Permission errors on specific files
            }
          } else if (entry.kind === 'directory') {
            dirCount++;
            // Skip heavy directories for safety
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'venv') {
              addCrawlLog(`[INFO] Skipping ignored directory: ${path}${entry.name}`);
              continue;
            }
            await crawlDirectory(entry, `${path}${entry.name}/`);
          }
        }
      } catch (e) {
        addCrawlLog(`[ERROR] Permission denied reading directory ${path}`);
      }
    };

    await crawlDirectory(dirHandle, '/');
    
    if (useAppStore.getState().isCrawling) {
      addCrawlLog(`[SUCCESS] Deep crawl finished! Found ${fileCount} files across ${dirCount} subdirectories.`);
      addCrawlLog(`[INFO] Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB.`);
      setIsCrawling(false);
    }
  };

  const handleStop = () => {
    setIsCrawling(false);
    addCrawlLog('[WARN] Crawl aborted by user.');
  };

  const handleBrowse = async () => {
    try {
      if ((window as any).showDirectoryPicker) {
        const handle = await (window as any).showDirectoryPicker();
        setDirHandle(handle);
        setTargetPath(handle.name);
        setSelectedFolder(handle.name);
        addRecentFolder(handle.name);
        addCrawlLog(`[INFO] Successfully granted access to directory: ${handle.name}`);
      } else {
        addCrawlLog('[ERROR] Your browser does not support the File System Access API. Please use Chrome or Edge.');
      }
    } catch (err) {
      console.error(err);
      addCrawlLog('[WARN] Directory selection cancelled.');
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">File Crawler</h2>
        <p className="text-muted-foreground mt-1">Configure and monitor your local file system analysis.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-md border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <FolderSearch className="w-5 h-5" /> Configuration
            </CardTitle>
            <CardDescription>Setup target directory for crawling.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Target Path</label>
              <div className="flex gap-2">
                <input 
                  list="recent-folders"
                  type="text" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors" 
                  placeholder="/path/to/project"
                  value={targetPath}
                  onChange={(e) => {
                    setTargetPath(e.target.value);
                    setSelectedFolder(e.target.value);
                  }}
                  disabled={isCrawling}
                />
                <datalist id="recent-folders">
                  {mounted && recentFolders.map((folder, i) => (
                    <option key={i} value={folder} />
                  ))}
                </datalist>
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleBrowse}
                  disabled={isCrawling}
                >
                  Browse...
                </Button>
              </div>
            </div>
            
            <div className="pt-4 flex gap-3">
              {!isCrawling ? (
                <Button onClick={handleStart} className="w-full gap-2 shadow-lg shadow-primary/20">
                  <Play className="w-4 h-4" /> Start Crawl
                </Button>
              ) : (
                <Button onClick={handleStop} variant="destructive" className="w-full gap-2 shadow-lg shadow-destructive/20 animate-pulse">
                  <Square className="w-4 h-4 fill-current" /> Stop Process
                </Button>
              )}
            </div>

            {mounted && recentFolders.length > 0 && (
              <div className="pt-6 border-t border-border/50">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Paths</h3>
                <div className="space-y-2">
                  {recentFolders.slice(0, 5).map((folder, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setTargetPath(folder);
                        setSelectedFolder(folder);
                      }}
                      className="text-xs p-2 rounded-md bg-muted/30 hover:bg-primary/20 hover:text-primary cursor-pointer truncate transition-colors border border-transparent hover:border-primary/30 flex items-center gap-2"
                      title={folder}
                    >
                      <FolderSearch className="w-3 h-3 opacity-50" />
                      {folder}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2 shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col h-[500px]">
          <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-muted-foreground" /> Console Output
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="h-full w-full bg-[#0d0d12] p-4 overflow-y-auto font-mono text-sm">
              {crawlLogs.length === 0 ? (
                <div className="text-muted-foreground/50 h-full flex items-center justify-center italic">Waiting for process to start...</div>
              ) : (
                crawlLogs.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.message.includes('[ERROR]') ? 'text-red-400' : log.message.includes('[SUCCESS]') ? 'text-green-400' : log.message.includes('[WARN]') ? 'text-yellow-400' : 'text-slate-300'}`}>
                    <span className="opacity-50 mr-2">{log.timestamp}</span>
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <FileTypeSelector />
    </div>
  );
}
