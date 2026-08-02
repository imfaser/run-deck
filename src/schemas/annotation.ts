import { z } from 'zod';

export const PointSignSchema = z.enum(['Positive', 'Negative']);
export type PointSign = z.infer<typeof PointSignSchema>;

export const BoxTypeSchema = z.enum(['Annotate', 'Visual']);
export type BoxType = z.infer<typeof BoxTypeSchema>;

// 前端工具/模式（源自旧版 label-raw）
export const LabelModeSchema = z.enum(['select', 'create', 'delete', 'move']);
export type LabelMode = z.infer<typeof LabelModeSchema>;

export const AnnotationTypeSchema = z.enum(['p_point', 'n_point', 'box']);
export type AnnotationType = z.infer<typeof AnnotationTypeSchema>;

export const AnnotationPointSchema = z.object({
  id: z.string(),
  annotation_id: z.string(),
  x: z.number(),
  y: z.number(),
  sign: PointSignSchema,
});
export type AnnotationPoint = z.infer<typeof AnnotationPointSchema>;

export const AnnotationBoxSchema = z.object({
  id: z.string(),
  annotation_id: z.string(),
  box_type: BoxTypeSchema,
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});
export type AnnotationBox = z.infer<typeof AnnotationBoxSchema>;

export const AnnotationSchema = z.object({
  id: z.string(),
  image_id: z.string(),
  label_id: z.string(),
  boxes: z.array(AnnotationBoxSchema),
  points: z.array(AnnotationPointSchema),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

// Inputs for db_set_annotations
export const PointInputSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  sign: PointSignSchema,
});
export type PointInput = z.infer<typeof PointInputSchema>;

export const BoxInputSchema = z.object({
  id: z.string(),
  box_type: BoxTypeSchema,
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});
export type BoxInput = z.infer<typeof BoxInputSchema>;

export const AnnotationInputSchema = z.object({
  id: z.string(),
  label_id: z.string(),
  boxes: z.array(BoxInputSchema),
  points: z.array(PointInputSchema),
});
export type AnnotationInput = z.infer<typeof AnnotationInputSchema>;

export const NearestVisualSchema = z.object({
  box_id: z.string(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  image_hash: z.string(),
  slice_index: z.number().nullable(),
  image_name: z.string().nullable(),
});
export type NearestVisual = z.infer<typeof NearestVisualSchema>;

export const AnnotationCountSchema = z.object({
  imageHash: z.string(),
  sliceIndex: z.number().nullable(),
  annotationCount: z.number(),
});
export type AnnotationCount = z.infer<typeof AnnotationCountSchema>;
