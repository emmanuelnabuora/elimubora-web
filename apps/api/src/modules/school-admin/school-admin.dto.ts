import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  capacity: z.number().int().positive().optional(),
  roomType: z.enum(['classroom', 'lab', 'hall', 'office', 'other']).default('classroom')
});
export type CreateRoomDto = z.infer<typeof createRoomSchema>;

/** Times as "HH:MM" 24-hour strings; converted to minutes-since-midnight for storage. */
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24-hour)');

export const createTimetableSlotSchema = z
  .object({
    classStreamId: z.string().uuid(),
    courseId: z.string().uuid(),
    teacherId: z.string().uuid(),
    roomId: z.string().uuid(),
    academicYear: z.number().int().min(2020).max(2100),
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: timeSchema,
    endTime: timeSchema
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime']
  });
export type CreateTimetableSlotDto = z.infer<typeof createTimetableSlotSchema>;

export const createLeaveRequestSchema = z.object({
  leaveType: z.enum(['sick', 'annual', 'compassionate', 'maternity', 'paternity', 'unpaid']),
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().max(2000).optional()
});
export type CreateLeaveRequestDto = z.infer<typeof createLeaveRequestSchema>;

export const decideLeaveRequestSchema = z.object({
  status: z.enum(['approved', 'rejected'])
});
export type DecideLeaveRequestDto = z.infer<typeof decideLeaveRequestSchema>;
