import { z } from 'zod';
import { BoxInputSchema, PointInputSchema } from '@/schemas/annotation';
import { OpenVolumeResponseSchema } from '@/schemas/volume';

export const TaskKindSchema = z.enum(['Segment', 'Detect']);
export type TaskKind = z.infer<typeof TaskKindSchema>;

export const TaskStatusSchema = z.enum(['Pending', 'Running', 'Done', 'Failed', 'Cancelled']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const DetectTargetSchema = z.object({
  label_id: z.string(),
  sub_labels: z.array(z.string()),
});
export type DetectTarget = z.infer<typeof DetectTargetSchema>;

export const TaskParamsSchema = z.object({
  use_prev_mask: z.boolean(),
  multimask_output: z.boolean(),
  targets: z.array(DetectTargetSchema),
});
export type TaskParams = z.infer<typeof TaskParamsSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: TaskKindSchema,
  status: TaskStatusSchema,
  enabled: z.boolean(),
  order: z.number(),
  volume_id: z.string(),
  range_start: z.number(),
  range_end: z.number(),
  params: TaskParamsSchema,
  error: z.string().nullable(),
  progress_current: z.number(),
  progress_total: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskCreateInputSchema = z.object({
  name: z.string().min(1),
  kind: TaskKindSchema,
  volumeId: z.string(),
  rangeStart: z.number().int().nonnegative(),
  rangeEnd: z.number().int().nonnegative(),
  params: TaskParamsSchema,
});
export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>;

export const TaskPatchSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  order: z.number().optional(),
  rangeStart: z.number().optional(),
  rangeEnd: z.number().optional(),
  params: TaskParamsSchema.optional(),
});
export type TaskPatch = z.infer<typeof TaskPatchSchema>;

export const TaskOrderInputSchema = z.object({
  id: z.string(),
  order: z.number(),
});
export type TaskOrderInput = z.infer<typeof TaskOrderInputSchema>;

export const AiObjectInputSchema = z.object({
  id: z.string(),
  label_id: z.string(),
  points: z.array(PointInputSchema),
  boxes: z.array(BoxInputSchema),
});
export type AiObjectInput = z.infer<typeof AiObjectInputSchema>;

export const AiRecognizeResponseSchema = z.object({
  maskHash: z.string(),
});
export type AiRecognizeResponse = z.infer<typeof AiRecognizeResponseSchema>;

export { OpenVolumeResponseSchema as CurrentVolumeSchema };
export type CurrentVolume = z.infer<typeof OpenVolumeResponseSchema>;
