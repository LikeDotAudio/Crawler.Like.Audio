import { secretsAuditor } from './secrets';
import { endpointsAuditor } from './endpoints';
import { deadcodeAuditor } from './deadcode';
import { depsAuditor } from './deps';
import { complexityAuditor } from './complexity';
import { AuditorModule } from './types';

export const ALL_AUDITORS: Record<string, AuditorModule> = {
  secrets: secretsAuditor,
  endpoints: endpointsAuditor,
  deadcode: deadcodeAuditor,
  deps: depsAuditor,
  complexity: complexityAuditor
};
