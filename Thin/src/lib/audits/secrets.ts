/**
 * secrets.ts — the "is there a credential in here" auditor for auditEngine.
 *
 * Owns two heuristics and nothing more: a filename blocklist (.env,
 * credentials, secret, id_rsa) and a content match for the WORDS api_key,
 * secret and password in json/yml/js/ts/py/env/config files.
 *
 * WHAT IT CANNOT DO, stated because the failure mode is a person trusting a
 * green result. It matches the word, never the value: a file that says
 * `password` in a comment is flagged and a 40-character API token assigned to a
 * variable called `t` is not. It cannot judge entropy, it does not read git
 * history — where a removed secret still lives — and it does not follow
 * imports. A clean run means "these words did not appear", and that is the
 * only claim it supports.
 *
 * It is a prompt to go and look, not a clearance. Widening it is welcome;
 * quoting it as proof is not.
 */

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
