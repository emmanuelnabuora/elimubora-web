import { requestExportSchema, updateRetentionSchema } from './platform-intelligence.dto';
import { PlatformIntelligenceService } from './platform-intelligence.service';

describe('PlatformIntelligenceService', () => {
  it('rejects invalid export formats at the validation layer', () => {
    const result = requestExportSchema.safeParse({ exportType: 'institutions', format: 'exe' });
    expect(result.success).toBe(false);
  });

  it('rejects nonpositive retention at the validation layer', () => {
    const result = updateRetentionSchema.safeParse({ retentionDays: 0 });
    expect(result.success).toBe(false);
  });

  it('does not expose private AI conversation retrieval methods', () => {
    // Deliberate safety boundary, not an incidental omission: a
    // platform_admin gets aggregate AI governance (models, policies,
    // usage, review queue) but never a way to read an individual
    // student's private conversation content through this service.
    const methods = Object.getOwnPropertyNames(PlatformIntelligenceService.prototype);
    expect(methods).not.toContain('getStudentConversation');
    expect(methods).not.toContain('getPrivatePromptHistory');
  });
});
