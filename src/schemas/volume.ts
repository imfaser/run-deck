import { z } from 'zod';

export const OpenVolumeInputSchema = z.object({
  path: z.string(),
  x: z.number().int().positive(),
  y: z.number().int().positive(),
  z: z.number().int().positive(),
  dtype: z.enum(['uint8', 'uint16']),
  endian: z.enum(['little', 'le', 'big', 'be']),
  axis: z.enum(['x', 'X', 'y', 'Y', 'z', 'Z']),
});
export type OpenVolumeInput = z.infer<typeof OpenVolumeInputSchema>;

export const OpenVolumeResponseSchema = z.object({
  volumeId: z.string(),
  totalSlices: z.number(),
  sliceWidth: z.number(),
  sliceHeight: z.number(),
});
export type OpenVolumeResponse = z.infer<typeof OpenVolumeResponseSchema>;

export const SliceResponseSchema = z.object({
  data: z.array(z.number()),
  width: z.number(),
  height: z.number(),
  min: z.number(),
  max: z.number(),
  imageHash: z.string(),
});
export type SliceResponse = z.infer<typeof SliceResponseSchema>;

export const VolumeConfigSchema = z.object({
  x: z.number().int().positive(),
  y: z.number().int().positive(),
  z: z.number().int().positive(),
  dtype: z.enum(['uint8', 'uint16']),
  endian: z.enum(['little', 'le', 'big', 'be']),
  axis: z.enum(['x', 'X', 'y', 'Y', 'z', 'Z']),
});
export type VolumeConfig = z.infer<typeof VolumeConfigSchema>;
