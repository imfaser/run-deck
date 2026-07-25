import { z } from 'zod';
import { AnnotationObjectSchema } from '@/schemas/annotation';

export const KeyframeSchema = z.object({
  objects: z.array(AnnotationObjectSchema),
  maskUrl: z.string().nullable(),
  maskVisible: z.boolean(),
  rawMaskHash: z.string().nullable(),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export const KeyframeRecordSchema = KeyframeSchema.extend({
  id: z.number().optional(),
  volumeId: z.string(),
  sliceIndex: z.number(),
});
export type KeyframeRecord = z.infer<typeof KeyframeRecordSchema>;

export const SliceSummarySchema = z.object({
  sliceIndex: z.number(),
  annotationCount: z.number(),
  hasMask: z.boolean(),
  maskVisible: z.boolean(),
});
export type SliceSummary = z.infer<typeof SliceSummarySchema>;
