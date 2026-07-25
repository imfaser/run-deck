import { z } from 'zod';

export const AnnotationTypeSchema = z.enum(['p_point', 'n_point', 'box']);
export type AnnotationType = z.infer<typeof AnnotationTypeSchema>;

export const LabelModeSchema = z.enum(['select', 'create', 'delete']);
export type LabelMode = z.infer<typeof LabelModeSchema>;

export const PointAnnotationSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  label: z.union([z.literal(0), z.literal(1)]),
});
export type PointAnnotation = z.infer<typeof PointAnnotationSchema>;

export const BoxAnnotationSchema = z.object({
  id: z.string(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  boxType: z.enum(['visual_ref']).optional(),
});
export type BoxAnnotation = z.infer<typeof BoxAnnotationSchema>;

export const AnnotationSchema = z.union([PointAnnotationSchema, BoxAnnotationSchema]);
export type Annotation = z.infer<typeof AnnotationSchema>;

export const AnnotationObjectSchema = z.object({
  id: z.string(),
  labelId: z.string(),
  subLabelId: z.string().optional(),
  points: z.array(PointAnnotationSchema),
  boxes: z.array(BoxAnnotationSchema),
});
export type AnnotationObject = z.infer<typeof AnnotationObjectSchema>;
