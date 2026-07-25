import { z } from 'zod';

export const VolumeDtypeSchema = z.enum(['u8', 'u16']);
export type VolumeDtype = z.infer<typeof VolumeDtypeSchema>;

export const VolumeEndianSchema = z.enum(['little', 'big']);
export type VolumeEndian = z.infer<typeof VolumeEndianSchema>;

export const VolumeAxisSchema = z.enum(['x', 'y', 'z']);
export type VolumeAxis = z.infer<typeof VolumeAxisSchema>;

export const VolumeConfigSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  dtype: VolumeDtypeSchema,
  endian: VolumeEndianSchema,
  axis: VolumeAxisSchema,
});
export type VolumeConfig = z.infer<typeof VolumeConfigSchema>;

export const VolumeInfoSchema = z.object({
  totalSlices: z.number(),
  sliceWidth: z.number(),
  sliceHeight: z.number(),
});
export type VolumeInfo = z.infer<typeof VolumeInfoSchema>;

export const MaskSettingsSchema = z.object({
  color: z.string(),
  prevMaskColor: z.string(),
  opacity: z.number(),
  threshold: z.number(),
  prevMaskAssist: z.boolean(),
});
export type MaskSettings = z.infer<typeof MaskSettingsSchema>;
