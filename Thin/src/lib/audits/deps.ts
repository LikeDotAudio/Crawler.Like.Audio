import { AuditContext, AuditorModule } from './types';

export const depsAuditor: AuditorModule = {
  id: 'deps',
  processFile: async (ctx: AuditContext) => {
    if (ctx.entryName === 'package.json') {
      if (ctx.text) {
        try {
          const json = JSON.parse(ctx.text);
          const deps = Object.keys(json.dependencies || {}).length;
          const devDeps = Object.keys(json.devDependencies || {}).length;
          ctx.addLog(`[DEPENDENCY] ${ctx.path}${ctx.entryName} -> ${deps} deps, ${devDeps} devDeps`);
          ctx.incrementIssues();
        } catch (e) {}
      }
    } else if (ctx.entryName === 'requirements.txt') {
      if (ctx.text) {
        const lines = ctx.text.split('\n').filter((l: string) => l.trim() && !l.startsWith('#')).length;
        ctx.addLog(`[DEPENDENCY] ${ctx.path}${ctx.entryName} -> ${lines} python packages`);
        ctx.incrementIssues();
      }
    }
  }
};
