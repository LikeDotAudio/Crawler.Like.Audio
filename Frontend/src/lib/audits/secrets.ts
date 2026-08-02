import { AuditContext, AuditorModule } from './types';

export const secretsAuditor: AuditorModule = {
  id: 'secrets',
  processFile: async (ctx: AuditContext) => {
    // Very basic secret scanning heuristics
    const suspiciousNames = ['.env', 'credentials', 'secret', 'id_rsa'];
    if (suspiciousNames.some(name => ctx.entryName.toLowerCase().includes(name))) {
      ctx.addLog(`[WARNING] Suspicious filename found: ${ctx.path}${ctx.entryName}`);
      ctx.incrementIssues();
    }
    
    // Check file contents if it's a code/config file
    if (['json', 'yml', 'yaml', 'js', 'ts', 'py', 'env', 'config'].includes(ctx.ext)) {
      if (ctx.text) {
        if (/api[_-]?key/i.test(ctx.text) || /secret/i.test(ctx.text) || /password/i.test(ctx.text)) {
          ctx.addLog(`[ALERT] Potential hardcoded secret in: ${ctx.path}${ctx.entryName}`);
          ctx.incrementIssues();
        }
      }
    }
  }
};
