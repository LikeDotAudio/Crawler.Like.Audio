import { AuditContext, AuditorModule } from './types';

export const deadcodeAuditor: AuditorModule = {
  id: 'deadcode',
  processFile: async (ctx: AuditContext) => {
    if (!ctx.sharedState.allFiles) ctx.sharedState.allFiles = new Set<string>();
    if (!ctx.sharedState.allImports) ctx.sharedState.allImports = new Set<string>();

    if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'php'].includes(ctx.ext)) {
      ctx.sharedState.allFiles.add(ctx.entryName);
      if (ctx.text) {
        const importMatches = ctx.text.match(/(?:import|require|include|from)[\s({]+['"]([^'"]+)['"]/gi);
        if (importMatches) {
          importMatches.forEach((m: string) => {
            const match = m.match(/['"]([^'"]+)['"]/);
            if (match && match[1]) {
              const basename = match[1].split('/').pop();
              if (basename) ctx.sharedState.allImports.add(basename.split('.')[0]);
            }
          });
        }
      }
    }
  },
  finalize: (ctx: AuditContext) => {
    const entryPoints = ['index.js', 'index.ts', 'main.js', 'main.ts', 'main.py', 'app.js', 'app.ts', 'page.tsx', 'layout.tsx'];
    const allFiles = ctx.sharedState.allFiles || new Set<string>();
    const allImports = ctx.sharedState.allImports || new Set<string>();
    
    allFiles.forEach((file: string) => {
      const base = file.split('.')[0];
      if (!entryPoints.includes(file) && !allImports.has(base)) {
        ctx.addLog(`[ORPHAN] File might be unused: ${file}`);
        ctx.incrementIssues();
      }
    });
  }
};
