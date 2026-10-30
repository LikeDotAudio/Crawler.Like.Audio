/**
 * auditEngine.ts — walks a directory the user has granted through the File
 * System Access API and runs every auditor in ALL_AUDITORS over each file.
 *
 * Owns: the walk, the .gitignore filter, and the log/issue callbacks. It does
 * NOT own what counts as a finding — each auditor in ./audits/ decides that,
 * and this file must stay ignorant of their rules so a new auditor is one file.
 *
 * Runs entirely in the browser. Nothing is uploaded and nothing is written back
 * to the chosen directory: the handle is used read-only, and it must stay that
 * way — the user granted a folder to be looked at, not edited.
 *
 * WHAT A CLEAN RUN DOES NOT MEAN. These are regex heuristics over a text scan,
 * not a scanner. A clean result means "none of the patterns in ./audits/
 * matched", and a user may not conclude the tree holds no secret, no dead code
 * and no unreachable endpoint. Read the auditor before quoting its result —
 * secrets.ts in particular is documented at its own head.
 */

import ignore from 'ignore';
import { ALL_AUDITORS } from '@/lib/audits';
import { AuditContext, AuditSharedState } from '@/lib/audits/types';
import { isFileHandle, isDirectoryHandle } from '@/lib/fsAccess';

export interface RunAuditEngineOptions {
  dirHandle: FileSystemDirectoryHandle | null;
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
  
  const ig = ignore();
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

  const sharedState: AuditSharedState = {};

  const scanDirectory = async (handle: FileSystemDirectoryHandle, path: string) => {
    for await (const entry of handle.values()) {
      const relativePath = path === '/' ? entry.name : path.substring(1) + entry.name;
      if (ig.ignores(entry.kind === 'directory' ? relativePath + '/' : relativePath)) continue;

      if (isDirectoryHandle(entry)) {
        await scanDirectory(entry, `${path}${entry.name}/`);
      } else if (isFileHandle(entry)) {
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
          file: file ?? null,
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
          file: null,
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
