import { z } from 'zod';

export const AnnotationTypeSchema = z.enum(['p_point', 'n_point', 'box']);
export type AnnotationType = z.infer<typeof AnnotationTypeSchema>;

export const LabelModeSchema = z.enum(['select', 'create', 'delete']);
export type LabelMode = z.infer<typeof LabelModeSchema>;

export const PointAnnotationSchema = z.object({
  id: z.string(),
  type: z.enum(['p_point', 'n_point']),
  x: z.number(),
  y: z.number(),
});
export type PointAnnotation = z.infer<typeof PointAnnotationSchema>;

export const BoxAnnotationSchema = z.object({
  id: z.string(),
  type: z.literal('box'),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});
export type BoxAnnotation = z.infer<typeof BoxAnnotationSchema>;

export const AnnotationSchema = z.discriminatedUnion('type', [
  PointAnnotationSchema,
  BoxAnnotationSchema,
]);
export type Annotation = z.infer<typeof AnnotationSchema>;
