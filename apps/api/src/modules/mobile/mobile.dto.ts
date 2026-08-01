import { z } from 'zod';

export const registerDeviceSchema = z.object({
  platform: z.enum(['ios', 'android']),
  pushToken: z.string().min(10).max(500)
});
export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;

export const unregisterDeviceSchema = z.object({
  pushToken: z.string().min(10).max(500)
});
export type UnregisterDeviceDto = z.infer<typeof unregisterDeviceSchema>;

/** Content-type allowlist — matches LocalFileStorageProvider's known extensions. */
export const uploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  /** Base64-encoded file bytes. A real mobile client sends the camera
   *  capture this way over the same JSON API every other endpoint uses —
   *  no separate multipart pipeline needed for a photo-sized payload. */
  dataBase64: z.string().min(1)
});
export type UploadDto = z.infer<typeof uploadSchema>;

export const startAttendanceSessionSchema = z.object({
  classStreamId: z.string().uuid(),
  attendanceDate: z.string().date()
});
export type StartAttendanceSessionDto = z.infer<typeof startAttendanceSessionSchema>;

export const redeemAttendanceQrSchema = z.object({
  token: z.string().min(1)
});
export type RedeemAttendanceQrDto = z.infer<typeof redeemAttendanceQrSchema>;

export const redeemAttendanceQrForStudentSchema = z.object({
  token: z.string().min(1),
  studentId: z.string().uuid()
});
export type RedeemAttendanceQrForStudentDto = z.infer<typeof redeemAttendanceQrForStudentSchema>;
