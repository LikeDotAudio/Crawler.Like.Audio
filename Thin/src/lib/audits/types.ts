/** Cross-file state the audit modules accumulate during one run (deadcode). */
export interface AuditSharedState {
  allFiles?: Set<string>;
  allImports?: Set<string>;
}

export interface AuditContext {
  /** null in finalize(), or when the file could not be read. */
  file: File | null;
  text: string | null;
  path: string;
  entryName: string;
  ext: string;
  addLog: (msg: string) => void;
  incrementIssues: () => void;
  sharedState: AuditSharedState;
}

export interface AuditorModule {
  id: string;
  processFile: (ctx: AuditContext) => Promise<void>;
  finalize?: (ctx: AuditContext) => void;
}
