import { z } from 'zod';

export const LocateRequestSchema = z.object({
  image: z.string(),
  task: z.enum(['detect', 'detect_visual']),
  categories: z.array(z.string()).optional(),
  visual_prompt: z.string().optional(),
  visual_prompt_box: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  generation_mode: z.string().default('hybrid'),
  max_new_tokens: z.number().default(8192),
});
export type LocateRequest = z.infer<typeof LocateRequestSchema>;

export const BoundingBoxSchema = z.object({
  name: z.string(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const DetectionResultSchema = z.object({
  boxes: z.array(BoundingBoxSchema),
});
export type DetectionResult = z.infer<typeof DetectionResultSchema>;
