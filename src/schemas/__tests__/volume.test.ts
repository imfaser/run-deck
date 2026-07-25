import { describe, it, expect } from 'vitest';
import { VolumeConfigSchema, VolumeInfoSchema, MaskSettingsSchema } from '@/schemas/volume';

describe('VolumeConfigSchema', () => {
  it('parses valid data', () => {
    const data = { x: 512, y: 512, z: 100, dtype: 'u16', endian: 'little', axis: 'z' };
    expect(VolumeConfigSchema.parse(data)).toEqual(data);
  });

  it('rejects invalid dtype', () => {
    const data = { x: 512, y: 512, z: 100, dtype: 'f32', endian: 'little', axis: 'z' };
    expect(() => VolumeConfigSchema.parse(data)).toThrow();
  });

  it('rejects invalid axis', () => {
    const data = { x: 512, y: 512, z: 100, dtype: 'u8', endian: 'little', axis: 'w' };
    expect(() => VolumeConfigSchema.parse(data)).toThrow();
  });
});

describe('VolumeInfoSchema', () => {
  it('parses valid data', () => {
    const data = { totalSlices: 100, sliceWidth: 512, sliceHeight: 512 };
    expect(VolumeInfoSchema.parse(data)).toEqual(data);
  });
});

describe('MaskSettingsSchema', () => {
  it('parses valid data', () => {
    const data = {
      color: '#ff0000',
      prevMaskColor: '#00ff00',
      opacity: 0.5,
      threshold: 0.8,
      prevMaskAssist: true,
    };
    expect(MaskSettingsSchema.parse(data)).toEqual(data);
  });

  it('rejects missing fields', () => {
    expect(() => MaskSettingsSchema.parse({})).toThrow();
  });
});
