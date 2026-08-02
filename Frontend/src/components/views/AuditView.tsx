"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, PackageSearch, Ghost, SearchCode, Ruler, FolderSearch, Play, Download } from 'lucide-react';
import ignore from 'ignore';
import { useAppStore } from '@/store/useAppStore';
import { ALL_AUDITORS } from '@/lib/audits';
import { AuditContext } from '@/lib/audits/types';

export function AuditView() {
  const { dirHandle, setDirHandle, selectedFolder, setSelectedFolder } = useAppStore();
  const [isAuditing, setIsAuditing] = useState(false);
  const [activeAudit, setActiveAudit] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setAuditLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleBrowse = async () => {
    try {
      if ((window as any).showDirectoryPicker) {
        const handle = await (window as any).showDirectoryPicker();
        setDirHandle(handle);
        setSelectedFolder(handle.name);
        setAuditLogs([]);
        addLog(`[INFO] Ready to audit directory: ${handle.name}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const downloadReport = () => {
    const content = auditLogs.join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audit_Report_${activeAudit || 'scan'}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runAudit = async (auditType: string) => {
    if (!dirHandle) {
      addLog('[ERROR] Please select a directory first.');
      return;
    }
    
    setIsAuditing(true);
    setActiveAudit(auditType);
    setAuditLogs([`[INFO] Starting ${auditType.toUpperCase()} Audit...`]);
    
    let ig = ignore();
    try {
      const gitignoreHandle = await dirHandle.getFileHandle('.gitignore');
      const file = await gitignoreHandle.getFile();
      const text = await file.text();
      ig.add(text);
    } catch (e) {}
    ig.add(['.git', 'node_modules', 'venv', '.next']);

    let filesScanned = 0;
    let issuesFound = 0;
    
    // Determine which modules to run
    const modulesToRun = auditType === 'all' 
      ? Object.values(ALL_AUDITORS) 
      : [ALL_AUDITORS[auditType]].filter(Boolean);

    const sharedState: Record<string, any> = {};

    const scanDirectory = async (handle: any, path: string) => {
      for await (const entry of handle.values()) {
        const relativePath = path === '/' ? entry.name : path.substring(1) + entry.name;
        if (ig.ignores(entry.kind === 'directory' ? relativePath + '/' : relativePath)) continue;

        if (entry.kind === 'directory') {
          await scanDirectory(entry, `${path}${entry.name}/`);
        } else if (entry.kind === 'file') {
          filesScanned++;
          
          let file: File | undefined;
          let text: string | null = null;
          const ext = entry.name.split('.').pop()?.toLowerCase() || '';

          // Only read text for files we expect might need it, and keep it under 500kb
          try {
            file = await entry.getFile();
            if (file && file.size < 1024 * 500) {
              text = await file.text();
            }
          } catch(e) {}

          const ctx: AuditContext = {
            file: file as File,
            text,
            path,
            entryName: entry.name,
            ext,
            addLog,
            incrementIssues: () => { issuesFound++; },
            sharedState
          };

          for (const mod of modulesToRun) {
            await mod.processFile(ctx);
          }
        }
      }
    };

    await scanDirectory(dirHandle, '/');
    
    // Run finalizers
    for (const mod of modulesToRun) {
      if (mod.finalize) {
        const ctx: AuditContext = {
          file: null as any,
          text: null,
          path: '/',
          entryName: '',
          ext: '',
          addLog,
          incrementIssues: () => { issuesFound++; },
          sharedState
        };
        mod.finalize(ctx);
      }
    }

    addLog(`[SUCCESS] Audit Complete! Scanned ${filesScanned} files. Found ${issuesFound} items of interest.`);
    setIsAuditing(false);
    setActiveAudit(null);
  };

  const auditModules = [
    { id: 'secrets', name: 'Secrets Scanner', icon: ShieldAlert, desc: 'Hunts for exposed API keys, passwords, and .env files.', color: 'text-red-400' },
    { id: 'endpoints', name: 'Endpoint Extractor', icon: SearchCode, desc: 'Rips through the codebase and extracts all hardcoded URLs and API endpoints.', color: 'text-blue-400' },
    { id: 'deadcode', name: 'Orphan File Detector', icon: Ghost, desc: 'Finds files that exist but are never imported anywhere.', color: 'text-zinc-400' },
    { id: 'deps', name: 'Dependency Auditor', icon: PackageSearch, desc: 'Summarizes external dependencies and licenses.', color: 'text-emerald-400' },
    { id: 'complexity', name: 'Complexity Profiler', icon: Ruler, desc: 'Highlights massive functions and cyclomatic complexity.', color: 'text-purple-400' }
  ];

  return (
    <div className="w-full flex-1 flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Project Audit</h2>
        <p className="text-muted-foreground mt-1">Deep-scan your codebase for security vulnerabilities, endpoints, and architecture metrics.</p>
      </div>
      
      <div className="flex gap-4">
        <div className="w-1/3 space-y-4">
          <Card className="shadow-md border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-primary text-base">
                <FolderSearch className="w-5 h-5" /> Target Selection
              </CardTitle>
              <Button 
                size="sm"
                onClick={() => runAudit('all')}
                disabled={isAuditing || !dirHandle}
                className="h-8 gap-2 shadow-sm"
              >
                {isAuditing && activeAudit === 'all' ? <Play className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                Run All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50" 
                  placeholder="Select a directory..."
                  value={selectedFolder || ''}
                  disabled
                />
                <Button onClick={handleBrowse} disabled={isAuditing} variant="secondary">Browse</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {auditModules.map(mod => (
              <Card key={mod.id} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex gap-3">
                    <div className={`p-2 rounded-lg bg-background border border-border flex items-center justify-center ${mod.color}`}>
                      <mod.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{mod.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-1">{mod.desc}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-8 gap-2 bg-background/50 hover:bg-primary/20 hover:text-primary"
                    disabled={isAuditing}
                    onClick={() => runAudit(mod.id)}
                  >
                    {isAuditing && activeAudit === mod.id ? <Play className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="w-2/3 shadow-md border-border/50 bg-card/80 backdrop-blur-sm flex flex-col">
          <CardHeader className="border-b border-border/50 bg-muted/30 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Audit Console Output</CardTitle>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-8 gap-2 bg-background hover:bg-primary/20 hover:text-primary transition-colors"
              onClick={downloadReport}
              disabled={auditLogs.length === 0 || isAuditing}
            >
              <Download className="w-3 h-3" /> Export Report
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden relative">
            <div className="h-[500px] w-full bg-[#0d0d12] p-4 overflow-y-auto font-mono text-sm">
              {auditLogs.length === 0 ? (
                <div className="text-muted-foreground/50 h-full flex items-center justify-center italic">Run an audit to view results...</div>
              ) : (
                auditLogs.map((log, i) => (
                  <div key={i} className={`mb-1 ${log.includes('[ALERT]') || log.includes('[ERROR]') ? 'text-red-400' : log.includes('[WARNING]') ? 'text-yellow-400' : log.includes('[SUCCESS]') ? 'text-green-400' : log.includes('[URL FOUND]') ? 'text-blue-400' : log.includes('[ORPHAN]') ? 'text-zinc-400' : log.includes('[DEPENDENCY]') ? 'text-emerald-400' : log.includes('[COMPLEXITY]') ? 'text-purple-400' : 'text-slate-300'}`}>
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
