import ignore from 'ignore';
import { ALL_AUDITORS } from '@/lib/audits';
import { AuditContext } from '@/lib/audits/types';

export interface RunAuditEngineOptions {
  dirHandle: any;
  auditType: string;
  onLog: (msg: string) => void;
  onComplete: (filesScanned: number, issuesFound: number) => void;
  onError: (err: Error | string) => void;
}

export async function runAuditEngine({ 
  dirHandle, 
  auditType, 
  onLog, 
  onComplete, 
  onError 
}: RunAuditEngineOptions) {
  if (!dirHandle) {
    onError('[ERROR] Please select a directory first.');
    return;
  }
  
  onLog(`[INFO] Starting ${auditType.toUpperCase()} Audit...`);
  
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
          addLog: onLog,
          incrementIssues: () => { issuesFound++; },
          sharedState
        };

        for (const mod of modulesToRun) {
          await mod.processFile(ctx);
        }
      }
    }
  };

  try {
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
          addLog: onLog,
          incrementIssues: () => { issuesFound++; },
          sharedState
        };
        mod.finalize(ctx);
      }
    }

    onLog(`[SUCCESS] Audit Complete! Scanned ${filesScanned} files. Found ${issuesFound} items of interest.`);
    onComplete(filesScanned, issuesFound);
  } catch (error) {
    onError(error instanceof Error ? error : String(error));
  }
}
