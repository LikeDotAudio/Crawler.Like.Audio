"use client";

import { useAppStore, extensionEmojiMap, FileCategory } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FolderSearch, Play, Square, FileText, Download, ShieldAlert, FolderTree, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { FileTypeSelector } from './FileTypeSelector';
import JSZip from 'jszip';
import { runCrawler } from '@/lib/crawlerEngine';
import { errorMessage } from "@/lib/utils";
import { isFileHandle, isDirectoryHandle } from '@/lib/fsAccess';
import { CATEGORIES, OTHER_CATEGORY, DEFAULT_SELECTED_CATEGORIES, categoryOf, extOf, isSkippedDir } from '@/lib/corpusFormat';
import { problem, isCancel } from '@/lib/apkSoftapp';

const preScanDirectory = async (dirHandle: FileSystemDirectoryHandle, updateCategories: (categories: FileCategory[]) => void, addLog: (msg: string) => void) => {
    addLog('[INFO] Starting fast pre-scan to discover file types...');
    const extStats: Record<string, { count: number, sizeBytes: number }> = {};
    let scannedFiles = 0;

    const scan = async (handle: FileSystemDirectoryHandle) => {
        try {
            for await (const entry of handle.values()) {
                if (isFileHandle(entry)) {
                    const file = await entry.getFile();
                    scannedFiles++;
                    const name = file.name;
                    const ext = extOf(name);
                    
                    if (!extStats[ext]) {
                        extStats[ext] = { count: 0, sizeBytes: 0 };
                    }
                    extStats[ext].count++;
                    extStats[ext].sizeBytes += file.size;
                    
                    if (scannedFiles % 2500 === 0) {
                        addLog(`[INFO] Pre-scanned ${scannedFiles} files...`);
                    }
                } else if (isDirectoryHandle(entry)) {
                    if (!isSkippedDir(entry.name)) {
                        await scan(entry);
                    }
                }
            }
        } catch (e) {
            // Ignore access errors
        }
    };

    await scan(dirHandle);

    // One category table for both halves: corpusFormat.CATEGORIES (Contract/corpus.v1.json).
    const categoriesMap: Record<string, FileCategory> = Object.fromEntries(
        [...Object.keys(CATEGORIES), OTHER_CATEGORY].map(name => [name, { name, extensions: [] as FileCategory['extensions'] }])
    );

    for (const [ext, stats] of Object.entries(extStats)) {
        if (!ext) continue;
        const catName = categoryOf(ext);
        categoriesMap[catName].extensions.push({
            ext,
            count: stats.count,
            sizeMB: stats.sizeBytes / (1024 * 1024),
            selected: DEFAULT_SELECTED_CATEGORIES.includes(catName),
            emoji: extensionEmojiMap[ext] || '📄'
        });
    }

    const finalCategories = Object.values(categoriesMap)
        .filter(c => c.extensions.length > 0)
        .map(c => ({
            ...c,
            extensions: c.extensions.sort((a, b) => b.count - a.count)
        }));

    updateCategories(finalCategories);
    addLog(`[SUCCESS] Pre-scan complete. Discovered ${scannedFiles} files and mapped their types.`);
};

export function CrawlerView() {
  const { isCrawling, setIsCrawling, selectedFolder, setSelectedFolder, dirHandle, setDirHandle, crawlLogs, addCrawlLog, mapText, scrapeText } = useAppStore();
  const [targetPath, setTargetPath] = useState(selectedFolder || '');
  const [respectGitIgnore, setRespectGitIgnore] = useState(true);

  const handleStart = async () => {
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
      const storeState = useAppStore.getState();
      const selectedExts = new Set(
        storeState.fileCategories
          .flatMap(cat => cat.extensions)
          .filter(ext => ext.selected)
          .map(ext => ext.ext.toLowerCase())
      );
      
      const result = await runCrawler({
        dirHandle,
        respectGitIgnore,
        selectedExts,
        fallbackAll: selectedExts.size === 0,
        addCrawlLog,
        checkIsCrawling: () => useAppStore.getState().isCrawling
      });
      
      if (result) {
        addCrawlLog(`[SUCCESS] Deep crawl finished! Found ${result.fileCount} files across ${result.dirCount} subdirectories.`);
        addCrawlLog(`[INFO] Total size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB.`);
        
        useAppStore.getState().setGraphData({ nodes: result.graphNodes, edges: result.graphEdges });
        
        // EVERYTHING.LOG already opens with the map (crawler-corpus v1).
        useAppStore.getState().setMapText(result.mapText);
        useAppStore.getState().setScrapeText(result.scrapeText);
        useAppStore.getState().setExtractorText(result.extractorText);
      }
    } catch (e) {
      console.error(e);
      addCrawlLog(`[ERROR] Crawl failed: ${errorMessage(e)}`);
      problem(e, { subject: 'Crawl', detail: errorMessage(e), fix: ['Browse to the folder again (the browser may have dropped its permission), then Start.'] });
    } finally {
      setIsCrawling(false);
    }
  };

  const handleStop = () => {
    setIsCrawling(false);
    addCrawlLog('[WARN] Crawl aborted by user.');
  };

  const handleBrowse = async () => {
    try {
      if (window.showDirectoryPicker) {
        const handle = await window.showDirectoryPicker();
        setDirHandle(handle);
        setTargetPath(handle.name);
        setSelectedFolder(handle.name);
        
        // Wipe previous crawl data so buttons disappear
        useAppStore.getState().setMapText('');
        useAppStore.getState().setScrapeText('');
        useAppStore.getState().setExtractorText('');
        useAppStore.getState().setGraphData(null);
        
        addCrawlLog(`[INFO] Successfully granted access to directory: ${handle.name}`);
        
        // Kick off prescan
        await preScanDirectory(handle, useAppStore.getState().setFileCategories, addCrawlLog);
        
      } else {
        addCrawlLog('[ERROR] Your browser does not support the File System Access API. Please use Chrome or Edge.');
        problem('unsupported_browser', { subject: 'Folder picker', fix: ['Open Crawler in Chrome or Edge on a desktop — they offer the folder picker (File System Access).'] });
      }
    } catch (err) {
      console.error(err);
      if (isCancel(err)) addCrawlLog('[WARN] Directory selection cancelled.');
      else {
        addCrawlLog(`[ERROR] Could not open that folder: ${errorMessage(err)}`);
        problem(err, { subject: 'Folder', onRetry: () => void handleBrowse() });
      }
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
      problem('save_failed', { subject: 'Crawler_Output .zip', detail: errorMessage(e),
        fix: ['Download MAP.txt and EVERYTHING.LOG one at a time instead.'], onRetry: () => void downloadZip() });
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
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="respect-gitignore" 
                checked={respectGitIgnore}
                onCheckedChange={(checked) => setRespectGitIgnore(checked === true)}
                disabled={isCrawling}
              />
              <label 
                htmlFor="respect-gitignore" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
              >
                Respect .gitignore (Skip ignored files)
              </label>
            </div>
            
            {!(mapText || scrapeText) && (
              <div className="pt-4 flex flex-col gap-3">
                {!isCrawling ? (
                  <Button onClick={() => handleStart()} className="w-full gap-2 shadow-lg shadow-primary/20 text-xs h-9 text-black font-bold">
                    <Play className="w-3 h-3" /> Start Crawl
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="w-full gap-2 shadow-lg shadow-destructive/20 animate-pulse text-xs h-9 font-bold">
                    <Square className="w-3 h-3 fill-current" /> Stop Process
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
      <FileTypeSelector />
      
      {(mapText || scrapeText) && !isCrawling && (
        <Card className="shadow-md border-border/50 bg-card/80 backdrop-blur-sm p-4 border-t-0">
          <div className="grid grid-cols-2 gap-4">
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
              <Button 
                onClick={() => useAppStore.getState().setActiveTab('scope-map')} 
                variant="default" 
                className="w-full gap-2 text-xs h-9 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-black font-bold"
              >
                <FolderTree className="w-3 h-3" /> Send to scope
              </Button>
              <Button 
                onClick={() => useAppStore.getState().setActiveTab('extractor')} 
                variant="default" 
                className="w-full gap-2 text-xs h-9 shadow-lg shadow-amber-500/20 bg-amber-600 hover:bg-amber-700 text-black font-bold"
              >
                <FileText className="w-3 h-3" /> Open commend and mark down
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
        </Card>
      )}

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
