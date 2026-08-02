import { AuditContext, AuditorModule } from './types';

export const endpointsAuditor: AuditorModule = {
  id: 'endpoints',
  processFile: async (ctx: AuditContext) => {
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'php'].includes(ctx.ext)) {
      if (ctx.text) {
        const urls = ctx.text.match(/https?:\/\/[^\s"'`)]+/gi);
        if (urls) {
          const uniqueUrls = Array.from(new Set(urls));
          uniqueUrls.forEach(url => {
            ctx.addLog(`[URL FOUND] ${ctx.path}${ctx.entryName} -> ${url}`);
            ctx.incrementIssues();
          });
        }
      }
    }
  }
};
