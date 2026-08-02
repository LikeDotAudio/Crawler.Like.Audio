"use client";

import { useAppStore, extensionEmojiMap } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderSearch, Play, Square, FileText, Download, ShieldAlert, FolderTree, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { FileTypeSelector } from './FileTypeSelector';
import { astParser } from '@/lib/astParser';
import ignore from 'ignore';
import JSZip from 'jszip';

export function CrawlerView() {
  const { isCrawling, setIsCrawling, selectedFolder, setSelectedFolder, dirHandle, setDirHandle, crawlLogs, addCrawlLog, mapText, scrapeText } = useAppStore();
  const [targetPath, setTargetPath] = useState(selectedFolder || '');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStart = async (respectGitIgnore: boolean = true) => {
    if (!dirHandle) {
      addCrawlLog('[WARN] You must click "Browse..." to grant the browser permission to read a local folder.');
      return;
    }
    
    if (targetPath) {
      // Intentionally omitting addRecentFolder since recent paths were removed.
    }
    
    setIsCrawling(true);
    addCrawlLog(`[INFO] Starting recursive crawl on ${dirHandle.name}...`);
    
    try {
      addCrawlLog('[INFO] Booting web-tree-sitter WASM engine...');
      await astParser.init();
      addCrawlLog('[SUCCESS] WebAssembly engine initialized for Python parsing.');
    } catch (e: any) {
      console.error(e);
      addCrawlLog(`[ERROR] Failed to load WASM engine: ${e.message || e}`);
    }
    
    let fileCount = 0;
    let dirCount = 0;
    let extCounts: Record<string, number> = {};
    let totalSize = 0;
    
    // Graph Data
    let graphNodes: any[] = [];
    let graphEdges: any[] = [];
    let fileLayoutIndex = 0;
    
    let mapTextBuilder = `# Program Map:\n# Created: ${new Date().toLocaleString()}\n#\n`;
    let scrapeTextBuilder = `# ====================================================================================\n# EVERYTHING.LOG\n# Log started at: ${new Date().toLocaleString()}\n# ====================================================================================\n\n`;

    const storeState = useAppStore.getState();
    const selectedExts = new Set(
      storeState.fileCategories
        .flatMap(cat => cat.extensions)
        .filter(ext => ext.selected)
        .map(ext => ext.ext)
    );

    let ig = ignore();
    if (respectGitIgnore) {
      try {
        const gitignoreHandle = await dirHandle.getFileHandle('.gitignore');
        const file = await gitignoreHandle.getFile();
        const text = await file.text();
        ig.add(text);
        addCrawlLog('[INFO] Found and loaded .gitignore rules.');
      } catch (e) {
        addCrawlLog('[INFO] No .gitignore found in root directory.');
      }
    } else {
      addCrawlLog('[INFO] Ignoring .gitignore rules as requested by user.');
    }
    // Always ignore these
    ig.add(['.git', 'node_modules', 'venv', '.crawler', '.next']);

    let globalTreeYIndex = 0;

    let rootNodeId = `dir-root`;
    graphNodes.push({
      id: rootNodeId,
      position: { x: 0, y: globalTreeYIndex * 80 },
      data: { label: `📁 ${dirHandle.name}`, depth: 0 },
      style: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }
    });
    globalTreeYIndex++;

    const crawlDirectory = async (handle: any, path: string, depth = 0, parentNodeId: string = rootNodeId) => {
      // Check store state directly to allow stopping mid-crawl
      if (!useAppStore.getState().isCrawling) return;
      
      try {
        for await (const entry of handle.values()) {
          if (!useAppStore.getState().isCrawling) break;
          
          const relativePath = path === '/' ? entry.name : path.substring(1) + entry.name;
          const isIgnored = ig.ignores(entry.kind === 'directory' ? relativePath + '/' : relativePath);
          
          if (isIgnored) {
            continue;
          }
          
          const currentNodeId = `${entry.kind}-${path}${entry.name}`;
          const currentY = globalTreeYIndex * 80;
          globalTreeYIndex++;
          
          if (entry.kind === 'file') {
            fileCount++;
            
            const ext = entry.name.includes('.') ? `.${entry.name.split('.').pop()}` : 'unknown';
            const emoji = extensionEmojiMap[ext] || '📄';
            
            mapTextBuilder += `${'  '.repeat(depth)}├── ${emoji} ${entry.name}\n`;
            
            if (fileCount % 500 === 0) {
              addCrawlLog(`[INFO] Scanned ${fileCount} files so far...`);
            }
            
            graphNodes.push({
              id: currentNodeId,
              position: { x: (depth + 1) * 280, y: currentY },
              data: { label: `${emoji} ${entry.name}`, depth: depth + 1 },
              style: { background: '#1e293b', color: '#fff', border: '2px solid #334155', borderRadius: '8px', padding: '10px' }
            });
            graphEdges.push({
              id: `e-${parentNodeId}-${currentNodeId}`,
              source: parentNodeId,
              target: currentNodeId,
              type: 'smoothstep',
              style: { stroke: '#475569' }
            });

            try {
              const file = await entry.getFile();
              totalSize += file.size;
              
              // const ext is already defined above
              extCounts[ext] = (extCounts[ext] || 0) + 1;
              
              if (selectedExts.has(ext)) {
                try {
                  const text = await file.text();
                  scrapeTextBuilder += `\n\n# --- File: ${path}${entry.name} ---\n`;
                  scrapeTextBuilder += text;
                } catch(e) {}
              }

              if (ext === '.py' && file.size < 1024 * 500) {
                try {
                  const text = await file.text();
                  const metrics = astParser.extractMetrics(text);
                  
                  if (metrics.structures.length > 0) {
                    metrics.structures.forEach((struct, idx) => {
                      const structId = `${currentNodeId}-${struct.name}-${idx}`;
                      const structY = globalTreeYIndex * 80;
                      globalTreeYIndex++;
                      
                      graphNodes.push({
                        id: structId,
                        position: { x: (depth + 2) * 280, y: structY },
                        data: { label: struct.name, depth: depth + 2 },
                        style: { 
                          background: struct.type === 'class' ? '#f97316' : '#0ea5e9', 
                          color: '#fff', 
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          padding: '6px 10px'
                        }
                      });
                      
                      graphEdges.push({
                        id: `e-${currentNodeId}-${structId}`,
                        source: currentNodeId,
                        target: structId,
                        type: 'smoothstep',
                        style: { stroke: struct.type === 'class' ? '#f97316' : '#0ea5e9', strokeWidth: 2 }
                      });
                    });
                  }
                  
                  if (metrics.classCount > 0 || metrics.functionCount > 0) {
                    addCrawlLog(`[AST] ${file.name} -> ${metrics.classCount} classes, ${metrics.functionCount} functions`);
                  }
                } catch(e) {}
              }
            } catch (e) {}
          } else if (entry.kind === 'directory') {
            dirCount++;
            mapTextBuilder += `${'  '.repeat(depth)}├── 📁 ${entry.name}/\n`;
            
            // Add Directory Node to Graph
            graphNodes.push({
              id: currentNodeId,
              position: { x: (depth + 1) * 280, y: currentY },
              data: { label: `📁 ${entry.name}`, depth: depth + 1 },
              style: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 'bold' }
            });
            graphEdges.push({
              id: `e-${parentNodeId}-${currentNodeId}`,
              source: parentNodeId,
              target: currentNodeId,
              type: 'smoothstep',
              style: { stroke: '#3b82f6', strokeWidth: 2 }
            });

            await crawlDirectory(entry, `${path}${entry.name}/`, depth + 1, currentNodeId);
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
      useAppStore.getState().setGraphData({ nodes: graphNodes, edges: graphEdges });
      
      scrapeTextBuilder = mapTextBuilder + "\n\n" + "-".repeat(84) + "\n\n" + scrapeTextBuilder;
      useAppStore.getState().setMapText(mapTextBuilder);
      useAppStore.getState().setScrapeText(scrapeTextBuilder);
      
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
        
        // Wipe previous crawl data so buttons disappear
        useAppStore.getState().setMapText('');
        useAppStore.getState().setScrapeText('');
        useAppStore.getState().setGraphData(null);
        
        addCrawlLog(`[INFO] Successfully granted access to directory: ${handle.name}`);
      } else {
        addCrawlLog('[ERROR] Your browser does not support the File System Access API. Please use Chrome or Edge.');
      }
    } catch (err) {
      console.error(err);
      addCrawlLog('[WARN] Directory selection cancelled.');
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadZip = async () => {
    try {
      const zip = new JSZip();
      if (mapText) zip.file("MAP.txt", mapText);
      if (scrapeText) zip.file("EVERYTHING.LOG", scrapeText);
      const logText = crawlLogs.map(l => `[${l.timestamp}] ${l.message}`).join("\n");
      zip.file("Crawl.log", logText);
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Crawler_Output_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      addCrawlLog('[ERROR] Failed to generate ZIP file.');
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Search className="w-8 h-8 text-primary" /> File Crawler
        </h2>
        <p className="text-muted-foreground mt-1">Configure and monitor your local file system analysis.</p>
      </div>
      
      <Card className="shadow-md border-border/50 bg-card/80 backdrop-blur-sm">
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
            
            {!(mapText || scrapeText) && (
              <div className="pt-4 flex flex-col gap-3">
                {!isCrawling ? (
                  <>
                    <Button onClick={() => handleStart(true)} className="w-full gap-2 shadow-lg shadow-primary/20 text-xs h-9 text-black font-bold">
                      <Play className="w-3 h-3" /> Start Crawl (Respect .gitignore)
                    </Button>
                    <Button onClick={() => handleStart(false)} variant="secondary" className="w-full gap-2 text-xs h-9 border border-border/50 text-black font-bold">
                      <Play className="w-3 h-3" /> Start Crawl (Ignore .gitignore)
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="w-full gap-2 shadow-lg shadow-destructive/20 animate-pulse text-xs h-9 font-bold">
                    <Square className="w-3 h-3 fill-current" /> Stop Process
                  </Button>
                )}
              </div>
            )}

            {(mapText || scrapeText) && !isCrawling && (
              <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => useAppStore.getState().setActiveTab('visualizer')} 
                    variant="default" 
                    className="w-full gap-2 text-xs h-9 shadow-lg shadow-primary/20 text-black font-bold"
                  >
                    <Play className="w-3 h-3" /> Send to Visualizer
                  </Button>
                  <Button 
                    onClick={() => useAppStore.getState().setActiveTab('program-map')} 
                    variant="default" 
                    className="w-full gap-2 text-xs h-9 shadow-lg shadow-purple-500/20 bg-purple-600 hover:bg-purple-700 text-black font-bold"
                  >
                    <FolderTree className="w-3 h-3" /> Send to Program Map
                  </Button>
                  <Button 
                    onClick={() => useAppStore.getState().setActiveTab('audit')} 
                    variant="default" 
                    className="w-full gap-2 text-xs h-9 shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-black font-bold"
                  >
                    <ShieldAlert className="w-3 h-3" /> Send to Auditor
                  </Button>
                </div>
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={downloadZip} 
                    variant="secondary" 
                    className="w-full gap-2 text-xs h-9 text-black font-bold"
                    disabled={!scrapeText}
                  >
                    <Download className="w-3 h-3" /> Download ZIP Bundle
                  </Button>
                  <Button 
                    onClick={() => downloadFile('MAP.txt', mapText)} 
                    variant="secondary" 
                    className="w-full gap-2 text-xs h-9 text-black font-bold"
                    disabled={!mapText}
                  >
                    <Download className="w-3 h-3" /> Download Map
                  </Button>
                  <Button 
                    onClick={() => downloadFile('EVERYTHING.LOG', scrapeText)} 
                    variant="secondary" 
                    className="w-full gap-2 text-xs h-9 text-black font-bold"
                    disabled={!scrapeText}
                  >
                    <Download className="w-3 h-3" /> Download Scrape
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
      <FileTypeSelector />
      
      <Card className="shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col h-[400px]">
        <CardHeader className="border-b border-border/50 bg-muted/30 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4" /> Console Output
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden relative">
          <div className="h-full w-full bg-[#0d0d12] p-4 overflow-y-auto font-mono text-sm absolute inset-0">
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
  );
}
