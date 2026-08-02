import { AuditContext, AuditorModule } from './types';

export const complexityAuditor: AuditorModule = {
  id: 'complexity',
  processFile: async (ctx: AuditContext) => {
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'php', 'c', 'cpp', 'rs'].includes(ctx.ext)) {
      if (ctx.text) {
        const lines = ctx.text.split('\n').length;
        if (lines > 500) {
          ctx.addLog(`[COMPLEXITY] ${ctx.path}${ctx.entryName} is massive! (${lines} lines)`);
          ctx.incrementIssues();
        }
        const complexity = (ctx.text.match(/if\s*\(|for\s*\(|while\s*\(|switch\s*\(/g) || []).length;
        if (complexity > 20) {
          ctx.addLog(`[COMPLEXITY] ${ctx.path}${ctx.entryName} has high cyclomatic complexity (score: ${complexity})`);
          ctx.incrementIssues();
        }
      }
    }
  }
};
