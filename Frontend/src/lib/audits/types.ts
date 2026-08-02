export interface AuditContext {
  file: File;
  text: string | null;
  path: string;
  entryName: string;
  ext: string;
  addLog: (msg: string) => void;
  incrementIssues: () => void;
  sharedState: Record<string, any>;
}

export interface AuditorModule {
  id: string;
  processFile: (ctx: AuditContext) => Promise<void>;
  finalize?: (ctx: AuditContext) => void;
}
