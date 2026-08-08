import { z } from 'zod';

export const createBroadcastSchema = z.object({
  title: z.string().trim().min(3).max(300),
  body: z.string().trim().min(3).max(5000),
  channel: z.enum(['in_app', 'email', 'sms', 'push']).default('in_app'),
  audienceType: z.enum(['all', 'county', 'institution_type', 'institution', 'role']).default('all'),
  audienceFilter: z.record(z.unknown()).default({})
});
export type CreateBroadcastDto = z.infer<typeof createBroadcastSchema>;
