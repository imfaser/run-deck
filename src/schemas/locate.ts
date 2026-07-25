import { z } from 'zod';

export const LocateConfigSchema = z.object({
  labelId: z.string(),
  mode: z.enum(['detect', 'detect_visual']),
  visualType: z.enum(['slice_crop', 'external_image']),
  visualRefObjectId: z.string().nullable(),
  visualRefImagePath: z.string().nullable(),
  rangeStart: z.number(),
  rangeEnd: z.number(),
});
export type LocateConfig = z.infer<typeof LocateConfigSchema>;

export const DetectProgressSchema = z.object({
  labelId: z.string(),
  current: z.number(),
  total: z.number(),
  status: z.enum(['idle', 'running', 'done', 'error']),
  error: z.string().optional(),
});
export type DetectProgress = z.infer<typeof DetectProgressSchema>;
