import { z } from 'zod';

export const ImageTypeSchema = z.enum(['File', 'Slice']);
export type ImageType = z.infer<typeof ImageTypeSchema>;

export const ImageSchema = z.object({
  hash: z.string(),
  image_name: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  image_type: ImageTypeSchema,
  volume_id: z.string().nullable(),
  slice_index: z.number().nullable(),
  mask_hash: z.string().nullable(),
});
export type Image = z.infer<typeof ImageSchema>;

export const ImageUpsertInputSchema = z.object({
  hash: z.string(),
  image_name: z.string().nullable().optional(),
  width: z.number(),
  height: z.number(),
  image_type: ImageTypeSchema,
  volume_id: z.string().nullable().optional(),
  slice_index: z.number().nullable().optional(),
  mask_hash: z.string().nullable().optional(),
});
export type ImageUpsertInput = z.infer<typeof ImageUpsertInputSchema>;
