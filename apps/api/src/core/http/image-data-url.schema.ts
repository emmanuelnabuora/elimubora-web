import { z } from 'zod';

/**
 * Validates an image data URL (data:image/...;base64,...), capped
 * well under Postgres's own limits. 2MB for the full string (roughly
 * 1.5MB of actual image data once base64's ~33% overhead is
 * accounted for) is generous for a logo or a headshot while keeping
 * row sizes reasonable, since these are stored directly as text
 * rather than in object storage.
 *
 * Shared across modules (tenant logos, student photos) rather than
 * duplicated per-module, since it's the exact same rule either way.
 */
export const imageDataUrlSchema = z
  .string()
  .max(2_000_000, 'Image is too large — please use a smaller file (under ~1.5MB).')
  .refine((v) => /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v), {
    message: 'Expected an image data URL (PNG, JPEG, WebP, or GIF).'
  });
